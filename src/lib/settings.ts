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

/**
 * `Math.max(30, valor)` só protege o piso quando `valor` é um número de verdade — com NaN,
 * `Math.max` sempre retorna NaN (independente do outro operando), e `setInterval(fn, NaN)` no
 * Node.js vira ~1ms (delay inválido colapsa pro mínimo) em vez de falhar, o que transformaria
 * qualquer valor inválido salvo nas settings num loop disparando centenas de vezes por segundo.
 * Por isso valida explicitamente que é um número finito antes de aplicar o piso.
 */
export function refreshIntervalMs(settings: GlobalSettings): number {
  const raw = settings.refreshIntervalSeconds;
  const seconds = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_REFRESH_INTERVAL_SECONDS;
  return Math.max(MIN_REFRESH_INTERVAL_SECONDS, seconds) * 1000;
}

/** Períodos suportados pelas actions "PRs Abertas", "Commits" e "Reviews Feitas". */
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
 * Settings da action "PRs Project". `repo` é obrigatório (nome do repositório); `org` é
 * opcional — se vazia, assume que o repositório é do próprio usuário. Mostra PRs de qualquer
 * autor (visão do repositório/equipe, não da conta pessoal — diferente das outras actions).
 */
export type PrsProjectSettings = {
  org?: string;
  repo?: string;
};
