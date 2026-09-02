import streamDeck, {
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { CelebrationTracker } from "./celebration-tracker.js";
import { errorLabel } from "./errors.js";
import { GhError } from "./gh.js";
import type { GlyphId } from "./glyphs.js";
import { iconAnimator, safeSetImage } from "./icon-animator.js";
import { renderBarChartIcon, renderMetricIcon, type MetricIconModel } from "./icon-render.js";
import type { MetricsSnapshot, PeriodTotals } from "./metrics.js";
import { metricsPoller } from "./poller.js";
import { PERIOD_LABEL, refreshIntervalMs, resolvePeriod, type GlobalSettings, type Period, type PeriodActionSettings } from "./settings.js";
import { ACCENTS, type AccentKey } from "./theme.js";

type IconState = "ok" | "stale" | "error";

/** Tempo que o gráfico de barras fica em tela antes de voltar sozinho pro número (clicar de novo volta na hora). */
const CHART_REVERT_MS = 9000;

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
  #lastState = new Map<string, IconState>();
  #lastPeriod = new Map<string, Period>();
  #activationChain = new Map<string, Promise<void>>();
  #tickInFlight = new Set<string>();
  #celebration = new CelebrationTracker();
  /** Teclas mostrando o gráfico de barras no momento (em vez do número) — ver `#showChart`/`#revertToNumber`. */
  #chartShowing = new Set<string>();
  #revertTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected abstract label(): string;
  /** Pictograma exibido no chip do ícone. */
  protected abstract glyphId(): GlyphId;
  /** Cor de destaque desta métrica (chip e pulso ao mudar de valor). */
  protected abstract accent(): AccentKey;
  protected abstract totals(snapshot: MetricsSnapshot): PeriodTotals;
  /** Busca os 4 períodos já escopados a uma organização específica (cada action tem sua própria fonte: GraphQL de contribuições, busca REST, etc.). */
  protected abstract fetchOrgPeriodTotals(org: string): Promise<PeriodTotals>;
  /**
   * Série diária do mês corrente (1 valor por dia já decorrido, índice 0 = dia 1) pro gráfico de
   * barras exibido ao clicar na tecla — cada action busca à sua própria fonte de dados (mesma
   * escolha de `fetchOrgPeriodTotals`: GraphQL de contribuições, busca REST ou Events API).
   * `org` reflete a mesma organização configurada na tecla, se houver.
   */
  protected abstract fetchDailyBreakdown(org?: string): Promise<number[]>;

  /**
   * Só `true` em actions cujo aumento de valor merece "comemoração" (ex.: PRs Abertas — mais
   * PRs suas em aberto é algo pra notar). Enquanto `true`, o ícone pisca em verde continuamente
   * a partir do momento em que o valor sobe, até o usuário clicar a tecla (não é o pulso normal,
   * que decai sozinho em ~1.1s independente de interação).
   */
  protected celebrateIncrease(): boolean {
    return false;
  }

  override onWillAppear(ev: WillAppearEvent<PeriodActionSettings>): void {
    if (!ev.action.isKey()) return;
    void this.#activate(ev.action);
  }

  override onWillDisappear(ev: WillDisappearEvent<PeriodActionSettings>): void {
    this.#deactivate(ev.action.id);
    this.#activationChain.delete(ev.action.id);
    this.#tickInFlight.delete(ev.action.id);
    this.#clearRevertTimer(ev.action.id);
    this.#chartShowing.delete(ev.action.id);
    iconAnimator.stop(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<PeriodActionSettings>): void {
    if (ev.action.isKey()) void this.#activate(ev.action);
  }

  /**
   * Clicar alterna entre número e gráfico de barras do mês corrente (não abre mais o GitHub no
   * navegador — PLANO.md/histórico tinham `openUrl` aqui antes dessa feature). Gráfico já em
   * tela: volta pro número na hora, cancelando a reversão automática. Número em tela: busca a
   * série diária e mostra o gráfico, que volta sozinho depois de `CHART_REVERT_MS`.
   */
  override async onKeyDown(ev: KeyDownEvent<PeriodActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const actionId = ev.action.id;
    const settings = await ev.action.getSettings();
    const model = this.#lastModel.get(actionId);
    // Clicar sempre confirma qualquer aumento pendente ("comemoração") — para de piscar em verde,
    // independente de estar mostrando número ou gráfico. Cada período tem sua própria base (ver
    // #handleCelebration), por isso precisa do período atual.
    if (this.celebrateIncrease()) {
      const period = resolvePeriod(settings);
      this.#celebration.acknowledge(this.#celebrationKey(actionId, period), model?.value ?? undefined);
    }

    if (this.#chartShowing.has(actionId)) {
      this.#revertToNumber(actionId, ev.action);
      return;
    }
    await this.#showChart(actionId, ev.action, settings.org?.trim());
  }

  /** Busca a série diária e desenha o gráfico de barras, agendando a reversão automática pro número. */
  async #showChart(actionId: string, action: KeyAction<PeriodActionSettings>, org: string | undefined): Promise<void> {
    this.#chartShowing.add(actionId);
    iconAnimator.stop(actionId);
    try {
      const counts = await this.fetchDailyBreakdown(org);
      // Um segundo clique pode ter chamado `#revertToNumber` (removendo de `#chartShowing`)
      // enquanto essa busca ainda estava em andamento — sem essa checagem, a busca em atraso
      // sobrescreveria o número que o usuário já tinha voltado a ver.
      if (!this.#chartShowing.has(actionId)) return;
      safeSetImage(action, renderBarChartIcon({ label: this.label(), counts }));
      this.#scheduleRevert(actionId, action);
    } catch (err) {
      streamDeck.logger.warn(`Falha ao buscar gráfico diário de ${this.label()}: ${err instanceof GhError ? err.message : String(err)}`);
      if (!this.#chartShowing.has(actionId)) return;
      this.#chartShowing.delete(actionId);
      this.#redrawLast(actionId, action);
    }
  }

  #scheduleRevert(actionId: string, action: KeyAction<PeriodActionSettings>): void {
    this.#clearRevertTimer(actionId);
    const timer = setTimeout(() => this.#revertToNumber(actionId, action), CHART_REVERT_MS);
    this.#revertTimers.set(actionId, timer);
  }

  #clearRevertTimer(actionId: string): void {
    const timer = this.#revertTimers.get(actionId);
    if (timer) clearTimeout(timer);
    this.#revertTimers.delete(actionId);
  }

  #revertToNumber(actionId: string, action: KeyAction<PeriodActionSettings>): void {
    this.#clearRevertTimer(actionId);
    this.#chartShowing.delete(actionId);
    this.#redrawLast(actionId, action);
  }

  /** Redesenha o último modelo/estado conhecidos (podem ter mudado enquanto o gráfico estava em tela — ver `#applyIcon`), sem pulsar. */
  #redrawLast(actionId: string, action: KeyAction<PeriodActionSettings>): void {
    const model = this.#lastModel.get(actionId);
    if (!model) {
      iconAnimator.stop(actionId);
      return;
    }
    const state = this.#lastState.get(actionId) ?? "ok";
    this.#drawIcon(actionId, action, model, state, false, undefined);
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
    this.#lastState.delete(actionId);
    this.#lastPeriod.delete(actionId);
    this.#clearRevertTimer(actionId);
    this.#chartShowing.delete(actionId);
    // Cada período rastreado por essa tecla tem sua própria base — limpa todos.
    for (const period of Object.keys(PERIOD_LABEL) as Period[]) this.#celebration.forget(this.#celebrationKey(actionId, period));
  }

  /**
   * Cada período (hoje/semana/mês/ano) mostra um número diferente pra mesma tecla — sem separar
   * a base de comemoração por período, trocar de período veria isso como "o valor mudou" e
   * pisc aria em verde por engano. Uma base por combinação tecla+período resolve.
   */
  #celebrationKey(actionId: string, period: Period): string {
    return `${actionId}:${period}`;
  }

  /**
   * Se `celebrateIncrease()` estiver ligado, delega ao `CelebrationTracker`: pisca em verde
   * continuamente enquanto o valor estiver acima da última leitura confirmada pelo usuário, e só
   * some quando ele clicar a tecla (`onKeyDown` chama `acknowledge`). Devolve `true` quando já
   * cuidou do desenho (pulso normal e "parado" não devem rodar por cima). Só é chamado quando
   * `allowPulse` também é `true` (mesmo período da última renderização, não troca de visualização).
   */
  #handleCelebration(actionId: string, period: Period, action: KeyAction<PeriodActionSettings>, model: MetricIconModel): boolean {
    if (model.value === null || !this.#celebration.observe(this.#celebrationKey(actionId, period), model.value)) return false;
    iconAnimator.breathe(actionId, action, (strength) => renderMetricIcon(model, { color: ACCENTS.green, strength }));
    return true;
  }

  /**
   * Guarda o modelo/estado mais recentes (sempre — mesmo com o gráfico em tela, pra reversão
   * mostrar dado fresco) e decide se desenha agora. Enquanto o gráfico de barras estiver em tela
   * (`#chartShowing`), nenhuma renderização de fundo (poll/tick) deve sobrescrevê-lo — `#drawIcon`
   * só roda de novo quando o usuário clicar (`#revertToNumber`) ou o timer de reversão disparar.
   */
  #applyIcon(actionId: string, action: KeyAction<PeriodActionSettings>, model: MetricIconModel, state: IconState, allowPulse: boolean, period: Period): void {
    const previous = this.#lastModel.get(actionId);
    this.#lastModel.set(actionId, model);
    this.#lastState.set(actionId, state);
    if (this.#chartShowing.has(actionId)) return;
    this.#drawIcon(actionId, action, model, state, allowPulse, period, previous);
  }

  /**
   * Decide entre pulso (valor mudou de verdade, mesmo período), respiração contínua
   * (desatualizado/erro) ou ícone parado, e desenha. `allowPulse=false` quando só o período de
   * visualização mudou (ou ao voltar do gráfico de barras) — nesse caso o número quase sempre é
   * diferente, mas isso não é uma atualização de dado, é navegação, então nunca deve pulsar.
   */
  #drawIcon(
    actionId: string,
    action: KeyAction<PeriodActionSettings>,
    model: MetricIconModel,
    state: IconState,
    allowPulse: boolean,
    period: Period | undefined,
    previous?: MetricIconModel,
  ): void {
    if (state === "error") {
      iconAnimator.breathe(actionId, action, (strength) => renderMetricIcon(model, { color: ACCENTS.red, strength }));
      return;
    }
    if (state === "stale") {
      iconAnimator.breathe(actionId, action, (strength) => renderMetricIcon(model, { color: ACCENTS.amber, strength }));
      return;
    }
    // `allowPulse` também é a guarda certa aqui: só considera comemorar numa atualização de dado
    // de verdade (mesmo período da última renderização), nunca numa troca de período de visualização.
    if (allowPulse && period && this.celebrateIncrease() && this.#handleCelebration(actionId, period, action, model)) return;
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
        this.#applyIcon(action.id, action, model, "error", false, "hoje");
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
    this.#applyIcon(action.id, action, model, error ? "stale" : "ok", allowPulse, period);
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
    this.#applyIcon(action.id, action, model, "ok", false, period);
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
      this.#applyIcon(action.id, action, model, "ok", allowPulse, period);
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
        this.#applyIcon(action.id, action, model, "stale", false, period);
      } else {
        const model: MetricIconModel = { glyphId: this.glyphId(), accent: this.accent(), label: this.label(), value: null, statusText: errorLabel(err) };
        this.#applyIcon(action.id, action, model, "error", false, period);
      }
      streamDeck.logger.warn(
        `Falha ao coletar ${this.label()} de ${org}: ${err instanceof GhError ? err.message : String(err)}`,
      );
    }
  }
}
