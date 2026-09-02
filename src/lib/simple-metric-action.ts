import streamDeck, {
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { reportError } from "./errors.js";
import { GhError } from "./gh.js";
import type { MetricsSnapshot } from "./metrics.js";
import { metricsPoller } from "./poller.js";
import { refreshIntervalMs, type GlobalSettings, type OrgFilterSettings } from "./settings.js";

/**
 * Base comum para actions que exibem um único número extraído do snapshot de métricas,
 * e que ao serem pressionadas abrem uma URL no GitHub. Cobre o ciclo de vida completo:
 * inscreve no poller central em onWillAppear, desinscreve em onWillDisappear (PLANO.md §3).
 *
 * Suporta opcionalmente um filtro de organização por tecla (`settings.org`, ver PI
 * `simple-metric-org.html`): quando vazio, a tecla assina o poller central (comportamento
 * original, sem custo extra de API); quando preenchido, a tecla passa a ter seu próprio timer
 * e busca (`fetchOrgScoped`), já que orgs diferentes por tecla não podem compartilhar um único
 * cache. Actions sem esse campo no PI (ex.: Estrelas Recebidas) nunca saem do primeiro modo.
 */
export abstract class SimpleMetricAction<TSettings extends OrgFilterSettings = OrgFilterSettings> extends SingletonAction<TSettings> {
  #unsubscribers = new Map<string, () => void>();
  #timers = new Map<string, ReturnType<typeof setInterval>>();
  #activeOrg = new Map<string, string | undefined>();
  #lastGoodOrgValue = new Map<string, number>();
  #latestSnapshot: MetricsSnapshot | null = null;
  #activationChain = new Map<string, Promise<void>>();
  #tickInFlight = new Set<string>();

  /** Rótulo curto exibido acima do número (ex.: "PRs"). */
  protected abstract label(): string;
  /** Extrai o valor a exibir a partir do snapshot mais recente (modo pessoal, sem org). */
  protected abstract value(snapshot: MetricsSnapshot): number;
  /** URL aberta no navegador ao pressionar a tecla (modo pessoal, sem org). */
  protected abstract url(snapshot: MetricsSnapshot | null): string;

  /**
   * Busca o valor já filtrado por uma organização específica, bypassando o poller central.
   * Sobrescrito pelas actions cujo PI expõe o campo "Organização"; as que não expõem esse
   * campo (settings.org sempre undefined) nunca chegam a chamar isso.
   */
  protected fetchOrgScoped(_org: string): Promise<number> {
    throw new Error("Esta action não suporta escopo de organização.");
  }

  /** URL ao clicar quando a tecla está escopada a uma organização (padrão: página da org). */
  protected urlOrgScoped(org: string): string {
    return `https://github.com/${org}`;
  }

  override onWillAppear(ev: WillAppearEvent<TSettings>): void {
    if (!ev.action.isKey()) return;
    void this.#activate(ev.action);
  }

  override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
    this.#deactivate(ev.action.id);
    this.#activationChain.delete(ev.action.id);
    this.#tickInFlight.delete(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<TSettings>): void {
    if (ev.action.isKey()) void this.#activate(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = await ev.action.getSettings();
    const org = settings.org?.trim();
    await streamDeck.system.openUrl(org ? this.urlOrgScoped(org) : this.url(this.#latestSnapshot));
    await ev.action.showOk();
  }

  /**
   * `onWillAppear`/`onDidReceiveSettings` podem disparar em rajada (o app reenvia settings,
   * troca de perfil, etc.). Sem serializar, duas chamadas de `#activate` concorrentes para a
   * MESMA tecla podiam passar as duas pela checagem "já está rodando?" antes de qualquer uma
   * terminar de registrar seu timer — cada uma criava um `setInterval` novo, e cada um desses
   * já dispara uma busca imediata (`#tickOrgScoped`), então uma rajada de N chamadas virava N
   * timers vazados e N buscas imediatas empilhadas. Encadear por tecla fecha essa janela.
   */
  async #activate(action: KeyAction<TSettings>): Promise<void> {
    const previous = this.#activationChain.get(action.id) ?? Promise.resolve();
    const current = previous.then(() => this.#activateSerial(action));
    this.#activationChain.set(
      action.id,
      current.catch(() => {}),
    );
    await current;
  }

  async #activateSerial(action: KeyAction<TSettings>): Promise<void> {
    const settings = await action.getSettings();
    const org = settings.org?.trim() || undefined;
    const alreadyRunning = this.#unsubscribers.has(action.id) || this.#timers.has(action.id);
    if (alreadyRunning && this.#activeOrg.get(action.id) === org) return; // nada mudou, mantém o modo/timer atual

    this.#deactivate(action.id);
    this.#activeOrg.set(action.id, org);

    if (!org) {
      const unsubscribe = metricsPoller.subscribe((snapshot, error) => {
        void this.#renderShared(action, snapshot, error);
      });
      this.#unsubscribers.set(action.id, unsubscribe);
      return;
    }

    void this.#tickOrgScoped(action, org);
    const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const timer = setInterval(() => void this.#tickOrgScoped(action, org), refreshIntervalMs(globalSettings));
    this.#timers.set(action.id, timer);
  }

  #deactivate(actionId: string): void {
    this.#unsubscribers.get(actionId)?.();
    this.#unsubscribers.delete(actionId);
    const timer = this.#timers.get(actionId);
    if (timer) clearInterval(timer);
    this.#timers.delete(actionId);
    this.#activeOrg.delete(actionId);
    this.#lastGoodOrgValue.delete(actionId);
  }

  async #renderShared(action: KeyAction<TSettings>, snapshot: MetricsSnapshot | null, error: GhError | null): Promise<void> {
    if (snapshot) this.#latestSnapshot = snapshot;
    if (!snapshot) {
      if (error) await reportError(action, error);
      return;
    }
    const staleMark = error ? " ⚠" : "";
    await action.setTitle(`${this.label()}\n${this.value(snapshot)}${staleMark}`);
    if (error) {
      // Tem cache válido, mas a última atualização falhou: mantém o número, marca "⚠" no título
      // (indicador visual de desatualizado, PLANO.md §6) e loga para diagnóstico.
      streamDeck.logger.warn(`Exibindo cache desatualizado para ${this.label()}: ${error.message}`);
    }
  }

  async #tickOrgScoped(action: KeyAction<TSettings>, org: string): Promise<void> {
    // Trava por tecla: nunca deixa duas buscas concorrentes se pilharem (timer + reativação
    // quase simultâneos, por exemplo) — a chamada nova é ignorada em vez de somar mais uma
    // chamada de `gh` em paralelo pra mesma tecla.
    if (this.#tickInFlight.has(action.id)) return;
    this.#tickInFlight.add(action.id);
    try {
      await this.#tickOrgScopedUnguarded(action, org);
    } finally {
      this.#tickInFlight.delete(action.id);
    }
  }

  async #tickOrgScopedUnguarded(action: KeyAction<TSettings>, org: string): Promise<void> {
    try {
      const value = await this.fetchOrgScoped(org);
      this.#lastGoodOrgValue.set(action.id, value);
      await action.setTitle(`${this.label()}\n${value}\n(${org})`);
    } catch (err) {
      const cached = this.#lastGoodOrgValue.get(action.id);
      if (cached !== undefined) {
        await action.setTitle(`${this.label()}\n${cached} ⚠\n(${org})`);
      } else {
        await reportError(action, err);
      }
      streamDeck.logger.warn(
        `Falha ao coletar ${this.label()} de ${org}: ${err instanceof GhError ? err.message : String(err)}`,
      );
    }
  }
}
