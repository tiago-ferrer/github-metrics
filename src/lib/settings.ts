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

/**
 * Settings comuns a qualquer action pessoal que aceite escopar sua métrica a uma organização
 * específica (ex.: "minhas PRs abertas, mas só as da org X"). `org` vazio/ausente mantém o
 * comportamento padrão (conta pessoal inteira, via poller central).
 */
export type OrgFilterSettings = {
  org?: string;
};

export type PeriodActionSettings = OrgFilterSettings & {
  period?: Period;
};

export function resolvePeriod(settings: PeriodActionSettings): Period {
  return settings.period ?? "hoje";
}

/**
 * Settings da action "PRs Abertas (Org)". `org` é obrigatório (login da organização); `repo`
 * é opcional — se vazio, agrega PRs de todos os repositórios da org, se preenchido, escopa
 * para um repositório específico dela (feature de organização, distinta das actions pessoais).
 */
export type OrgActionSettings = {
  org?: string;
  repo?: string;
};
