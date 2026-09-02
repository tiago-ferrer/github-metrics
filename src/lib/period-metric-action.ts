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
import { fetchOrgPeriodContributions, type MetricsSnapshot, type OrgPeriodContributions, type PeriodTotals } from "./metrics.js";
import { metricsPoller } from "./poller.js";
import { PERIOD_LABEL, refreshIntervalMs, resolvePeriod, type GlobalSettings, type PeriodActionSettings } from "./settings.js";

/**
 * Base para actions com período configurável pelo Property Inspector (hoje/semana/mês/ano) —
 * usada por Commits e Reviews Feitas. Mesmo ciclo de vida da SimpleMetricAction, incluindo o
 * filtro opcional de organização (`settings.org`): vazio assina o poller central, preenchido
 * usa timer + busca próprios (`fetchOrgPeriodContributions`, GraphQL escopada via
 * `organizationID`). Trocar só o período, com a org já ativa, reaproveita o último resultado em
 * vez de refazer a chamada de rede — os 4 períodos já vêm juntos numa única busca.
 */
export abstract class PeriodMetricAction extends SingletonAction<PeriodActionSettings> {
  #unsubscribers = new Map<string, () => void>();
  #timers = new Map<string, ReturnType<typeof setInterval>>();
  #activeOrg = new Map<string, string | undefined>();
  #latest: { snapshot: MetricsSnapshot | null; error: GhError | null } = { snapshot: null, error: null };
  #lastGoodOrgTotals = new Map<string, PeriodTotals>();
  #activationChain = new Map<string, Promise<void>>();
  #tickInFlight = new Set<string>();

  protected abstract label(): string;
  protected abstract totals(snapshot: MetricsSnapshot): PeriodTotals;
  /** Extrai commits ou reviews (conforme a action) do resultado escopado por organização. */
  protected abstract orgTotals(contributions: OrgPeriodContributions): PeriodTotals;
  /** @param snapshot Último snapshot conhecido (pode ser usado para montar URLs com o username). */
  protected abstract url(snapshot: MetricsSnapshot | null): string;
  /** URL ao clicar quando a tecla está escopada a uma organização (padrão: página da org). */
  protected urlOrgScoped(org: string): string {
    return `https://github.com/${org}`;
  }

  override onWillAppear(ev: WillAppearEvent<PeriodActionSettings>): void {
    if (!ev.action.isKey()) return;
    void this.#activate(ev.action);
  }

  override onWillDisappear(ev: WillDisappearEvent<PeriodActionSettings>): void {
    this.#deactivate(ev.action.id);
    this.#activationChain.delete(ev.action.id);
    this.#tickInFlight.delete(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<PeriodActionSettings>): void {
    if (ev.action.isKey()) void this.#activate(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<PeriodActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = await ev.action.getSettings();
    const org = settings.org?.trim();
    await streamDeck.system.openUrl(org ? this.urlOrgScoped(org) : this.url(this.#latest.snapshot));
    await ev.action.showOk();
  }

  /**
   * Serializado por tecla pelo mesmo motivo do SimpleMetricAction: sem isso, uma rajada de
   * onWillAppear/onDidReceiveSettings concorrentes podia empilhar vários `setInterval` (cada um
   * já disparando uma busca imediata) pra mesma tecla, sem nenhum cancelar o anterior.
   */
  async #activate(action: KeyAction<PeriodActionSettings>): Promise<void> {
    const previous = this.#activationChain.get(action.id) ?? Promise.resolve();
    const current = previous.then(() => this.#activateSerial(action));
    this.#activationChain.set(
      action.id,
      current.catch(() => {}),
    );
    await current;
  }

  async #activateSerial(action: KeyAction<PeriodActionSettings>): Promise<void> {
    const settings = await action.getSettings();
    const org = settings.org?.trim() || undefined;
    const alreadyRunning = this.#unsubscribers.has(action.id) || this.#timers.has(action.id);
    if (alreadyRunning && this.#activeOrg.get(action.id) === org) {
      // só o período mudou (org é a mesma) — os 4 períodos já estão no cache, só re-renderiza
      if (org) await this.#renderOrgScoped(action, org);
      else void this.#renderShared(action);
      return;
    }

    this.#deactivate(action.id);
    this.#activeOrg.set(action.id, org);

    if (!org) {
      const unsubscribe = metricsPoller.subscribe((snapshot, error) => {
        this.#latest = { snapshot, error };
        void this.#renderShared(action);
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
    this.#lastGoodOrgTotals.delete(actionId);
  }

  async #renderShared(action: KeyAction<PeriodActionSettings>): Promise<void> {
    const { snapshot, error } = this.#latest;
    if (!snapshot) {
      if (error) await reportError(action, error);
      return;
    }
    const settings = await action.getSettings();
    const period = resolvePeriod(settings);
    const value = this.totals(snapshot)[period];
    const staleMark = error ? " ⚠" : "";
    await action.setTitle(`${this.label()}\n${value}${staleMark}\n(${PERIOD_LABEL[period]})`);
    if (error) {
      // Cache válido, mas última atualização falhou: mantém o número, marca "⚠" (PLANO.md §6).
      streamDeck.logger.warn(`Exibindo cache desatualizado para ${this.label()}: ${error.message}`);
    }
  }

  async #renderOrgScoped(action: KeyAction<PeriodActionSettings>, org: string): Promise<void> {
    const cached = this.#lastGoodOrgTotals.get(action.id);
    if (!cached) {
      await this.#tickOrgScoped(action, org);
      return;
    }
    const settings = await action.getSettings();
    const period = resolvePeriod(settings);
    await action.setTitle(`${this.label()}\n${cached[period]}\n(${PERIOD_LABEL[period]} · ${org})`);
  }

  async #tickOrgScoped(action: KeyAction<PeriodActionSettings>, org: string): Promise<void> {
    // Trava por tecla: evita duas buscas concorrentes (timer + reativação quase simultâneos)
    // somando chamadas de `gh`/GraphQL em paralelo pra mesma tecla.
    if (this.#tickInFlight.has(action.id)) return;
    this.#tickInFlight.add(action.id);
    try {
      await this.#tickOrgScopedUnguarded(action, org);
    } finally {
      this.#tickInFlight.delete(action.id);
    }
  }

  async #tickOrgScopedUnguarded(action: KeyAction<PeriodActionSettings>, org: string): Promise<void> {
    const settings = await action.getSettings();
    const period = resolvePeriod(settings);
    try {
      const contributions = await fetchOrgPeriodContributions(org);
      const totals = this.orgTotals(contributions);
      this.#lastGoodOrgTotals.set(action.id, totals);
      await action.setTitle(`${this.label()}\n${totals[period]}\n(${PERIOD_LABEL[period]} · ${org})`);
    } catch (err) {
      const cached = this.#lastGoodOrgTotals.get(action.id);
      if (cached) {
        await action.setTitle(`${this.label()}\n${cached[period]} ⚠\n(${PERIOD_LABEL[period]} · ${org})`);
      } else {
        await reportError(action, err);
      }
      streamDeck.logger.warn(
        `Falha ao coletar ${this.label()} de ${org}: ${err instanceof GhError ? err.message : String(err)}`,
      );
    }
  }
}
