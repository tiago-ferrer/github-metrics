import streamDeck, {
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { errorLabel } from "./errors.js";
import { GhError } from "./gh.js";
import type { GlyphId } from "./glyphs.js";
import { iconAnimator, safeSetImage } from "./icon-animator.js";
import { renderMetricIcon, type MetricIconModel } from "./icon-render.js";
import type { MetricsSnapshot, PeriodTotals } from "./metrics.js";
import { metricsPoller } from "./poller.js";
import { PERIOD_LABEL, refreshIntervalMs, resolvePeriod, type GlobalSettings, type Period, type PeriodActionSettings } from "./settings.js";
import { ACCENTS, type AccentKey } from "./theme.js";

type IconState = "ok" | "stale" | "error";

/**
 * Base para actions com período configurável pelo Property Inspector (hoje/semana/mês/ano) —
 * usada por PRs Abertas, Commits e Reviews Feitas. Mesmo ciclo de vida da SimpleMetricAction
 * (ícone dinâmico via `setImage`, filtro opcional de organização), com uma diferença: trocar só
 * o período de visualização (mesma org, mesmo dado) nunca pulsa — o pulso é reservado pra quando
 * o número da métrica muda de verdade entre atualizações. Os 4 períodos já vêm juntos numa única
 * busca (`fetchOrgPeriodTotals`, própria de cada action), então trocar o período com a org já
 * ativa reaproveita o resultado em vez de refazer a chamada de rede.
 */
export abstract class PeriodMetricAction extends SingletonAction<PeriodActionSettings> {
  #unsubscribers = new Map<string, () => void>();
  #timers = new Map<string, ReturnType<typeof setInterval>>();
  #activeOrg = new Map<string, string | undefined>();
  #latest: { snapshot: MetricsSnapshot | null; error: GhError | null } = { snapshot: null, error: null };
  #lastGoodOrgTotals = new Map<string, PeriodTotals>();
  #lastModel = new Map<string, MetricIconModel>();
  #lastPeriod = new Map<string, Period>();
  #activationChain = new Map<string, Promise<void>>();
  #tickInFlight = new Set<string>();

  protected abstract label(): string;
  /** Pictograma exibido no chip do ícone. */
  protected abstract glyphId(): GlyphId;
  /** Cor de destaque desta métrica (chip e pulso ao mudar de valor). */
  protected abstract accent(): AccentKey;
  protected abstract totals(snapshot: MetricsSnapshot): PeriodTotals;
  /** Busca os 4 períodos já escopados a uma organização específica (cada action tem sua própria fonte: GraphQL de contribuições, busca REST, etc.). */
  protected abstract fetchOrgPeriodTotals(org: string): Promise<PeriodTotals>;
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
    iconAnimator.stop(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<PeriodActionSettings>): void {
    if (ev.action.isKey()) void this.#activate(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<PeriodActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = await ev.action.getSettings();
    const org = settings.org?.trim();
    await streamDeck.system.openUrl(org ? this.urlOrgScoped(org) : this.url(this.#latest.snapshot));
    // Confirmação tátil: um flash breve e neutro sobre o ícone atual, no lugar do showOk() padrão.
    const model = this.#lastModel.get(ev.action.id);
    if (model) {
      iconAnimator.pulse(ev.action.id, ev.action, (strength) =>
        renderMetricIcon(model, strength > 0.01 ? { color: "#FFFFFF", strength: strength * 0.55 } : undefined),
      );
    }
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
    this.#lastModel.delete(actionId); // muda o escopo (org liga/desliga) — valor anterior não é comparável
    this.#lastPeriod.delete(actionId);
  }

  /**
   * Decide entre pulso (valor mudou de verdade, mesmo período), respiração contínua
   * (desatualizado/erro) ou ícone parado, e desenha. `allowPulse=false` quando só o período de
   * visualização mudou — nesse caso o número quase sempre é diferente, mas isso não é uma
   * atualização de dado, é navegação, então nunca deve pulsar.
   */
  #applyIcon(actionId: string, action: KeyAction<PeriodActionSettings>, model: MetricIconModel, state: IconState, allowPulse: boolean): void {
    const previous = this.#lastModel.get(actionId);
    this.#lastModel.set(actionId, model);

    if (state === "error") {
      iconAnimator.breathe(actionId, action, (strength) => renderMetricIcon(model, { color: ACCENTS.red, strength }));
      return;
    }
    if (state === "stale") {
      iconAnimator.breathe(actionId, action, (strength) => renderMetricIcon(model, { color: ACCENTS.amber, strength }));
      return;
    }
    if (allowPulse && previous && previous.value !== model.value) {
      const accentColor = ACCENTS[this.accent()];
      iconAnimator.pulse(actionId, action, (strength) => renderMetricIcon(model, strength > 0.01 ? { color: accentColor, strength } : undefined));
      return;
    }
    iconAnimator.stop(actionId);
    safeSetImage(action, renderMetricIcon(model));
  }

  /** Marca o período usado nesta renderização e diz se é o mesmo da última vez (pra decidir se pulsar faz sentido). */
  #trackPeriod(actionId: string, period: Period): boolean {
    const allowPulse = this.#lastPeriod.get(actionId) === period;
    this.#lastPeriod.set(actionId, period);
    return allowPulse;
  }

  async #renderShared(action: KeyAction<PeriodActionSettings>): Promise<void> {
    const { snapshot, error } = this.#latest;
    if (!snapshot) {
      if (error) {
        const model: MetricIconModel = { glyphId: this.glyphId(), accent: this.accent(), label: this.label(), value: null, statusText: errorLabel(error) };
        this.#applyIcon(action.id, action, model, "error", false);
      }
      return;
    }
    const settings = await action.getSettings();
    const period = resolvePeriod(settings);
    const allowPulse = this.#trackPeriod(action.id, period);
    const model: MetricIconModel = {
      glyphId: this.glyphId(),
      accent: this.accent(),
      label: this.label(),
      value: this.totals(snapshot)[period],
      scopeLabel: error ? `${PERIOD_LABEL[period]} · desatualizado` : PERIOD_LABEL[period],
    };
    this.#applyIcon(action.id, action, model, error ? "stale" : "ok", allowPulse);
    if (error) {
      // Cache válido, mas última atualização falhou: mantém o número, respira em âmbar (PLANO.md §6).
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
    this.#trackPeriod(action.id, period); // só re-renderiza a partir do cache — nunca pulsa aqui
    const model: MetricIconModel = { glyphId: this.glyphId(), accent: this.accent(), label: this.label(), value: cached[period], scopeLabel: `${PERIOD_LABEL[period]} · ${org}` };
    this.#applyIcon(action.id, action, model, "ok", false);
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
      const totals = await this.fetchOrgPeriodTotals(org);
      this.#lastGoodOrgTotals.set(action.id, totals);
      const allowPulse = this.#trackPeriod(action.id, period);
      const model: MetricIconModel = { glyphId: this.glyphId(), accent: this.accent(), label: this.label(), value: totals[period], scopeLabel: `${PERIOD_LABEL[period]} · ${org}` };
      this.#applyIcon(action.id, action, model, "ok", allowPulse);
    } catch (err) {
      const cached = this.#lastGoodOrgTotals.get(action.id);
      this.#trackPeriod(action.id, period);
      if (cached) {
        const model: MetricIconModel = {
          glyphId: this.glyphId(),
          accent: this.accent(),
          label: this.label(),
          value: cached[period],
          scopeLabel: `${PERIOD_LABEL[period]} · ${org} · desatualizado`,
        };
        this.#applyIcon(action.id, action, model, "stale", false);
      } else {
        const model: MetricIconModel = { glyphId: this.glyphId(), accent: this.accent(), label: this.label(), value: null, statusText: errorLabel(err) };
        this.#applyIcon(action.id, action, model, "error", false);
      }
      streamDeck.logger.warn(
        `Falha ao coletar ${this.label()} de ${org}: ${err instanceof GhError ? err.message : String(err)}`,
      );
    }
  }
}
