/** Global Settings — compartilhadas por todas as actions (PLANO.md §4). */
export type GlobalSettings = {
  /** Login do GitHub; se vazio, é resolvido automaticamente via `gh api user`. */
  githubUsername?: string;
  /** Caminho custom para o binário do gh, caso não esteja no PATH do processo do Stream Deck. */
  ghBinaryPath?: string;
  /** Intervalo de refresh do poller central, em segundos. */
  refreshIntervalSeconds?: number;
};

export const DEFAULT_REFRESH_INTERVAL_SECONDS = 60;
export const MIN_REFRESH_INTERVAL_SECONDS = 30;

export function refreshIntervalMs(settings: GlobalSettings): number {
  const seconds = Math.max(MIN_REFRESH_INTERVAL_SECONDS, settings.refreshIntervalSeconds ?? DEFAULT_REFRESH_INTERVAL_SECONDS);
  return seconds * 1000;
}

/** Períodos suportados pelas actions "Commits" e "Reviews Feitas". */
export type Period = "hoje" | "semana" | "mes" | "ano";

export const PERIOD_LABEL: Record<Period, string> = {
  hoje: "hoje",
  semana: "semana",
  mes: "mês",
  ano: "ano",
};

export type PeriodActionSettings = {
  period?: Period;
};

export function resolvePeriod(settings: PeriodActionSettings): Period {
  return settings.period ?? "hoje";
}
