import streamDeck from "@elgato/streamdeck";
import { GhError } from "./gh.js";
import { fetchSnapshot, type MetricsSnapshot } from "./metrics.js";
import { type GlobalSettings, refreshIntervalMs } from "./settings.js";

export type MetricsListener = (snapshot: MetricsSnapshot | null, error: GhError | null) => void;

/**
 * Poller central: uma única execução por ciclo alimenta o cache em memória; cada action
 * apenas lê o cache. Só roda enquanto houver pelo menos 1 listener inscrito (ligado/desligado
 * via onWillAppear/onWillDisappear nas actions — ver PLANO.md §3).
 */
class MetricsPoller {
  #timer: ReturnType<typeof setInterval> | null = null;
  #listeners = new Set<MetricsListener>();
  #cache: MetricsSnapshot | null = null;
  #lastError: GhError | null = null;
  #inFlight: Promise<void> | null = null;

  subscribe(listener: MetricsListener): () => void {
    this.#listeners.add(listener);
    listener(this.#cache, this.#lastError);
    void this.#ensureRunning();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#stop();
    };
  }

  /** Força uma atualização imediata (ex.: usuário mudou o username/intervalo nas settings). */
  async refreshNow(): Promise<void> {
    await this.#tick();
  }

  async #ensureRunning(): Promise<void> {
    if (this.#timer) return;
    await this.#tick();
    if (this.#listeners.size === 0) return; // todos desinscreveram durante o fetch inicial
    const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    this.#timer = setInterval(() => void this.#tick(), refreshIntervalMs(settings));
  }

  #stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  async #tick(): Promise<void> {
    if (this.#inFlight) {
      await this.#inFlight;
      return;
    }
    this.#inFlight = this.#fetchAndNotify();
    try {
      await this.#inFlight;
    } finally {
      this.#inFlight = null;
    }
  }

  async #fetchAndNotify(): Promise<void> {
    try {
      this.#cache = await fetchSnapshot();
      this.#lastError = null;
    } catch (err) {
      this.#lastError = err instanceof GhError ? err : new GhError(String(err), "unknown", err);
      streamDeck.logger.error("Falha ao coletar métricas do GitHub", this.#lastError);
      // mantém #cache anterior (última leitura válida) para exibir dado "desatualizado" em vez de zerar
    }
    this.#notify();
  }

  #notify(): void {
    for (const listener of this.#listeners) listener(this.#cache, this.#lastError);
  }
}

export const metricsPoller = new MetricsPoller();
