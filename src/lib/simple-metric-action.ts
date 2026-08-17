import streamDeck, {
  SingletonAction,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { reportError } from "./errors.js";
import type { GhError } from "./gh.js";
import type { MetricsSnapshot } from "./metrics.js";
import { metricsPoller } from "./poller.js";

/**
 * Base comum para actions que exibem um único número extraído do snapshot de métricas,
 * e que ao serem pressionadas abrem uma URL no GitHub. Cobre o ciclo de vida completo:
 * inscreve no poller central em onWillAppear, desinscreve em onWillDisappear (PLANO.md §3).
 */
export abstract class SimpleMetricAction extends SingletonAction {
  #unsubscribers = new Map<string, () => void>();
  #latestSnapshot: MetricsSnapshot | null = null;

  /** Rótulo curto exibido acima do número (ex.: "PRs"). */
  protected abstract label(): string;
  /** Extrai o valor a exibir a partir do snapshot mais recente. */
  protected abstract value(snapshot: MetricsSnapshot): number;
  /** URL aberta no navegador ao pressionar a tecla. */
  protected abstract url(snapshot: MetricsSnapshot | null): string;

  override onWillAppear(ev: WillAppearEvent): void {
    if (!ev.action.isKey()) return;
    const action = ev.action;
    const unsubscribe = metricsPoller.subscribe((snapshot, error) => {
      void this.#render(action, snapshot, error);
    });
    this.#unsubscribers.set(action.id, unsubscribe);
  }

  override onWillDisappear(ev: WillDisappearEvent): void {
    this.#unsubscribers.get(ev.action.id)?.();
    this.#unsubscribers.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    await streamDeck.system.openUrl(this.url(this.#latestSnapshot));
    if (ev.action.isKey()) await ev.action.showOk();
  }

  async #render(action: KeyAction, snapshot: MetricsSnapshot | null, error: GhError | null): Promise<void> {
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
}
