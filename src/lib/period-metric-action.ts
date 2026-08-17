import streamDeck, {
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { reportError } from "./errors.js";
import type { GhError } from "./gh.js";
import type { MetricsSnapshot, PeriodTotals } from "./metrics.js";
import { metricsPoller } from "./poller.js";
import { PERIOD_LABEL, resolvePeriod, type PeriodActionSettings } from "./settings.js";

/**
 * Base para actions com período configurável pelo Property Inspector (hoje/semana/mês/ano) —
 * usada por Commits e Reviews Feitas. Mesmo ciclo de vida da SimpleMetricAction, mas o valor
 * exibido depende também da settings da instância (lida via `action.getSettings()`).
 */
export abstract class PeriodMetricAction extends SingletonAction<PeriodActionSettings> {
  #unsubscribers = new Map<string, () => void>();
  #latest: { snapshot: MetricsSnapshot | null; error: GhError | null } = { snapshot: null, error: null };

  protected abstract label(): string;
  protected abstract totals(snapshot: MetricsSnapshot): PeriodTotals;
  /** @param snapshot Último snapshot conhecido (pode ser usado para montar URLs com o username). */
  protected abstract url(snapshot: MetricsSnapshot | null): string;

  override onWillAppear(ev: WillAppearEvent<PeriodActionSettings>): void {
    if (!ev.action.isKey()) return;
    const action = ev.action;
    const unsubscribe = metricsPoller.subscribe((snapshot, error) => {
      this.#latest = { snapshot, error };
      void this.#render(action);
    });
    this.#unsubscribers.set(action.id, unsubscribe);
  }

  override onWillDisappear(ev: WillDisappearEvent<PeriodActionSettings>): void {
    this.#unsubscribers.get(ev.action.id)?.();
    this.#unsubscribers.delete(ev.action.id);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<PeriodActionSettings>): void {
    if (ev.action.isKey()) void this.#render(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<PeriodActionSettings>): Promise<void> {
    await streamDeck.system.openUrl(this.url(this.#latest.snapshot));
    if (ev.action.isKey()) await ev.action.showOk();
  }

  async #render(action: KeyAction<PeriodActionSettings>): Promise<void> {
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
}
