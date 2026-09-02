import streamDeck from "@elgato/streamdeck";
import { runGh, runGhJson } from "./gh.js";
import type { GlobalSettings, Period } from "./settings.js";

export type PeriodTotals = Record<Period, number>;

export type MetricsSnapshot = {
  fetchedAt: number;
  username: string;
  prsOpen: PeriodTotals;
  reviewRequested: number;
  issuesAssigned: number;
  notifications: number;
  starsReceived: number;
  commits: PeriodTotals;
  reviewsDone: PeriodTotals;
  pushes: PeriodTotals;
  prComments: PeriodTotals;
  inlineComments: PeriodTotals;
};

export async function resolveUsername(settings: GlobalSettings): Promise<string> {
  const custom = settings.githubUsername?.trim();
  if (custom) return custom;
  return runGh(["api", "user", "--jq", ".login"]);
}

/**
 * `--limit=1000` (teto da própria API de busca do GitHub) evita subcontagem: o default do `gh`
 * é 30 resultados, o que passa despercebido nas métricas pessoais mas é facilmente ultrapassado
 * em contagens no nível de organização (ver `org-prs.ts`).
 */
export async function countSearch(args: string[]): Promise<number> {
  const out = await runGh([...args, "--limit=1000", "--json", "number", "--jq", "length"]);
  return Number(out || 0);
}

async function fetchNotifications(): Promise<number> {
  const out = await runGh(["api", "notifications", "--jq", "length"]);
  return Number(out || 0);
}

/** PRs com minha review solicitada, restritas aos repositórios de uma organização específica. */
export async function fetchOrgScopedReviewRequested(org: string): Promise<number> {
  return countSearch(["search", "prs", "--review-requested=@me", "--state=open", `--owner=${org.trim()}`]);
}

/** Issues atribuídas a mim, restritas aos repositórios de uma organização específica. */
export async function fetchOrgScopedIssuesAssigned(org: string): Promise<number> {
  return countSearch(["search", "issues", "--assignee=@me", "--state=open", `--owner=${org.trim()}`]);
}

type NotificationLite = { repository?: { owner?: { login?: string } } };

/**
 * Notificações não lidas cujo repositório pertence a uma organização específica. A API de
 * notificações não tem um filtro de owner/org nativo, então busca todas as páginas
 * (`--paginate --slurp` — `--slurp` não pode ser combinado com `--jq`, ver nota em PLANO.md)
 * e filtra no lado do cliente.
 */
export async function fetchOrgScopedNotifications(org: string): Promise<number> {
  const trimmedOrg = org.trim();
  const pages = await runGhJson<NotificationLite[][]>(["api", "notifications", "--paginate", "--slurp"]);
  return pages.flat().filter((n) => n.repository?.owner?.login === trimmedOrg).length;
}

function isoStartOfTodayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function daysAgoMs(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function startOfTodayUtcMs(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function isoStartOfMonthUtc(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthUtcMs(): number {
  return new Date(isoStartOfMonthUtc()).getTime();
}

/** Dia do mês (1-31) de "hoje" em UTC — também o número de barras do gráfico mensal (1 por dia já decorrido, incluindo hoje). */
function currentUtcDayOfMonth(): number {
  return new Date().getUTCDate();
}

/**
 * Agrupa timestamps (ms) em contagem por dia do mês corrente — 1 posição por dia já decorrido
 * (índice 0 = dia 1, último índice = hoje). Descarta qualquer timestamp fora do mês corrente
 * (mês anterior, ou por segurança um `createdAt`/`created_at` no futuro).
 */
function bucketMsByDayOfMonth(msValues: number[], dayCount: number): number[] {
  const counts = new Array<number>(dayCount).fill(0);
  const monthStartMs = startOfMonthUtcMs();
  for (const ms of msValues) {
    if (ms < monthStartMs) continue;
    const day = new Date(ms).getUTCDate();
    if (day >= 1 && day <= dayCount) counts[day - 1]++;
  }
  return counts;
}

type CreatedAtItem = { createdAt: string };

/**
 * PRs abertas por mim (`@me`) criadas dentro de cada janela de tempo e que ainda estão abertas
 * agora — não é "todas as PRs abertas agora" (isso não combina com período: uma PR pode estar
 * aberta há meses).
 *
 * A API de busca do GitHub tem um limite bem mais apertado que o resto da API (30 requisições
 * por minuto) — por isso, em vez de 4 chamadas (uma por janela), busca só a janela mais larga
 * (`ano`, 365 dias — sem o mesmo "from omitido = ano corrido" que o GraphQL do
 * `contributionsCollection` oferece) com a data de criação de cada PR, e conta hoje/semana/mês
 * no lado do cliente. 1 chamada em vez de 4.
 */
async function fetchPrsOpenPeriodTotals(owner?: string): Promise<PeriodTotals> {
  const args = ["search", "prs", "--author=@me", "--state=open", `--created=>=${isoDaysAgo(365)}`, "--limit=1000", "--json", "createdAt"];
  if (owner) args.push(`--owner=${owner}`);
  const items = await runGhJson<CreatedAtItem[]>(args);

  const todayMs = startOfTodayUtcMs();
  const weekMs = daysAgoMs(7);
  const monthMs = daysAgoMs(30);
  let hoje = 0;
  let semana = 0;
  let mes = 0;
  for (const item of items) {
    const createdMs = new Date(item.createdAt).getTime();
    if (createdMs >= todayMs) hoje++;
    if (createdMs >= weekMs) semana++;
    if (createdMs >= monthMs) mes++;
  }
  return { hoje, semana, mes, ano: items.length };
}

/** PRs abertas por mim, por período, em toda a conta pessoal (usado pelo poller central). */
export async function fetchPrsOpenByPeriod(): Promise<PeriodTotals> {
  return fetchPrsOpenPeriodTotals();
}

/** PRs abertas por mim, por período, restritas aos repositórios de uma organização específica. */
export async function fetchOrgPrsOpenByPeriod(org: string): Promise<PeriodTotals> {
  return fetchPrsOpenPeriodTotals(org.trim());
}

/**
 * Série diária do mês corrente pra PRs Abertas: 1 valor por dia já decorrido (índice 0 = dia 1,
 * último = hoje) — quantas PRs minhas foram criadas naquele dia e ainda seguem abertas agora.
 * Reaproveita a mesma chamada de busca de `fetchPrsOpenPeriodTotals` (1 requisição), trocando só
 * a janela (início do mês em vez de 365 dias) e o agrupamento (por dia, não por período).
 */
export async function fetchPrsOpenDailyBreakdown(owner?: string): Promise<number[]> {
  const args = ["search", "prs", "--author=@me", "--state=open", `--created=>=${isoStartOfMonthUtc()}`, "--limit=1000", "--json", "createdAt"];
  if (owner) args.push(`--owner=${owner}`);
  const items = await runGhJson<CreatedAtItem[]>(args);
  const dayCount = currentUtcDayOfMonth();
  return bucketMsByDayOfMonth(
    items.map((item) => new Date(item.createdAt).getTime()),
    dayCount,
  );
}

type GitHubEvent = {
  type: string;
  created_at: string;
  repo?: { name?: string };
  payload?: { issue?: { pull_request?: unknown } };
};

const isPushEvent = (e: GitHubEvent): boolean => e.type === "PushEvent";
/** GitHub trata comentário de PR como "comentário de issue" — só dá pra saber que é PR pela presença de `payload.issue.pull_request`. */
const isPrCommentEvent = (e: GitHubEvent): boolean => e.type === "IssueCommentEvent" && Boolean(e.payload?.issue?.pull_request);
/** Comentário em linha específica do diff (parte de uma review), diferente do comentário geral na conversa da PR. */
const isInlineCommentEvent = (e: GitHubEvent): boolean => e.type === "PullRequestReviewCommentEvent";

/**
 * `contributionsCollection` (GraphQL) não expõe push nem comentário como tipo de contribuição —
 * só a Events API (`/users/{username}/events`) tem esses dados, via os tipos de evento brutos do
 * GitHub. Duas limitações reais da própria API, sem contorno possível:
 *
 * 1. Só cobre os **últimos ~90 dias** de histórico (e no máximo ~300 eventos) — diferente das
 *    outras métricas, aqui "ano" não é um ano de verdade, é só o que a API devolver.
 * 2. Pra outra conta que não a autenticada no `gh` (via `githubUsername`), só mostra eventos
 *    **públicos** — eventos de repositório privado só aparecem se for a própria conta logada.
 *
 * Busca só uma vez (evita pedir 3x a mesma lista pra cada métrica) e conta os 3 tipos de evento
 * a partir do mesmo resultado.
 */
async function fetchRecentEvents(username: string): Promise<GitHubEvent[]> {
  return runGhJson<GitHubEvent[]>(["api", `users/${username}/events`, "--paginate"]);
}

function bucketEventsByPeriod(events: GitHubEvent[], matches: (e: GitHubEvent) => boolean, org?: string): PeriodTotals {
  const todayMs = startOfTodayUtcMs();
  const weekMs = daysAgoMs(7);
  const monthMs = daysAgoMs(30);
  let hoje = 0;
  let semana = 0;
  let mes = 0;
  let ano = 0;
  for (const event of events) {
    if (!matches(event)) continue;
    if (org && !event.repo?.name?.startsWith(`${org}/`)) continue;
    const createdMs = new Date(event.created_at).getTime();
    ano++;
    if (createdMs >= monthMs) mes++;
    if (createdMs >= weekMs) semana++;
    if (createdMs >= todayMs) hoje++;
  }
  return { hoje, semana, mes, ano };
}

export type ActivityTotals = {
  pushes: PeriodTotals;
  prComments: PeriodTotals;
  inlineComments: PeriodTotals;
};

async function fetchActivityTotals(username: string, org?: string): Promise<ActivityTotals> {
  const events = await fetchRecentEvents(username);
  return {
    pushes: bucketEventsByPeriod(events, isPushEvent, org),
    prComments: bucketEventsByPeriod(events, isPrCommentEvent, org),
    inlineComments: bucketEventsByPeriod(events, isInlineCommentEvent, org),
  };
}

/** Pushes/comentários por período, em toda a conta pessoal (usado pelo poller central). */
export async function fetchActivityTotalsForUser(username: string): Promise<ActivityTotals> {
  return fetchActivityTotals(username);
}

/** Pushes/comentários por período, restritos aos repositórios de uma organização específica. */
export async function fetchOrgActivityTotals(org: string): Promise<ActivityTotals> {
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  const username = await resolveUsername(settings);
  return fetchActivityTotals(username, org.trim());
}

export type ActivityKind = "pushes" | "prComments" | "inlineComments";

const ACTIVITY_MATCHERS: Record<ActivityKind, (e: GitHubEvent) => boolean> = {
  pushes: isPushEvent,
  prComments: isPrCommentEvent,
  inlineComments: isInlineCommentEvent,
};

/**
 * Série diária do mês corrente pra Pushes/PR Comments/Inline Comments: 1 valor por dia já
 * decorrido. Mesma fonte de `fetchActivityTotals` (Events API, sujeita ao mesmo limite de ~90
 * dias de histórico — dias no início do mês podem ficar incompletos se o mês for longo o
 * suficiente pra ultrapassar essa janela), só que agrupada por dia em vez de por período. Resolve
 * o username sozinho (mesmo padrão de `fetchOrgActivityTotals`) — o chamador só tem `org`.
 */
export async function fetchActivityDailyBreakdown(kind: ActivityKind, org?: string): Promise<number[]> {
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  const username = await resolveUsername(settings);
  const events = await fetchRecentEvents(username);
  const matches = ACTIVITY_MATCHERS[kind];
  const trimmedOrg = org?.trim();
  const filtered = events.filter((e) => matches(e) && (!trimmedOrg || e.repo?.name?.startsWith(`${trimmedOrg}/`)));
  const dayCount = currentUtcDayOfMonth();
  return bucketMsByDayOfMonth(
    filtered.map((e) => new Date(e.created_at).getTime()),
    dayCount,
  );
}

async function graphql<T>(query: string, variables: Record<string, string>): Promise<T> {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-F", `${key}=${value}`);
  }
  return runGhJson<T>(args);
}

/**
 * Query combinada: commits + reviews (3 janelas de tempo) + estrelas recebidas
 * (primeira página de repositórios), em UMA chamada GraphQL. Ver PLANO.md §2.
 */
const COMBINED_QUERY = `
query($login: String!, $todayFrom: DateTime!, $weekFrom: DateTime!, $monthFrom: DateTime!, $now: DateTime!) {
  user(login: $login) {
    hoje: contributionsCollection(from: $todayFrom, to: $now) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    semana: contributionsCollection(from: $weekFrom, to: $now) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    mes: contributionsCollection(from: $monthFrom, to: $now) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    ano: contributionsCollection {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    repositories(ownerAffiliations: OWNER, first: 100, isFork: false) {
      nodes {
        stargazerCount
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

const STARS_PAGE_QUERY = `
query($login: String!, $after: String!) {
  user(login: $login) {
    repositories(ownerAffiliations: OWNER, first: 100, isFork: false, after: $after) {
      nodes {
        stargazerCount
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

type ContributionWindow = {
  totalCommitContributions: number;
  totalPullRequestReviewContributions: number;
};

type RepoPage = {
  nodes: { stargazerCount: number }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type CombinedQueryResponse = {
  data: {
    user: {
      hoje: ContributionWindow;
      semana: ContributionWindow;
      mes: ContributionWindow;
      ano: ContributionWindow;
      repositories: RepoPage;
    };
  };
};

type StarsPageResponse = {
  data: { user: { repositories: RepoPage } };
};

/** Soma estrelas de todas as páginas; a maioria dos usuários cabe em 1 chamada (≤100 repos). */
async function sumStars(firstPage: RepoPage, login: string): Promise<number> {
  let total = firstPage.nodes.reduce((sum, r) => sum + r.stargazerCount, 0);
  let page = firstPage;
  let iterations = 0;
  while (page.pageInfo.hasNextPage && iterations < 10) {
    const res = await graphql<StarsPageResponse>(STARS_PAGE_QUERY, {
      login,
      after: page.pageInfo.endCursor ?? "",
    });
    page = res.data.user.repositories;
    total += page.nodes.reduce((sum, r) => sum + r.stargazerCount, 0);
    iterations++;
  }
  return total;
}

export async function fetchSnapshot(): Promise<MetricsSnapshot> {
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  const username = await resolveUsername(settings);
  const now = new Date().toISOString();

  const [prsOpen, reviewRequested, issuesAssigned, notifications, combined, activity] = await Promise.all([
    fetchPrsOpenByPeriod(),
    countSearch(["search", "prs", "--review-requested=@me", "--state=open"]),
    countSearch(["search", "issues", "--assignee=@me", "--state=open"]),
    fetchNotifications(),
    graphql<CombinedQueryResponse>(COMBINED_QUERY, {
      login: username,
      todayFrom: isoStartOfTodayUtc(),
      weekFrom: isoDaysAgo(7),
      monthFrom: isoDaysAgo(30),
      now,
    }),
    fetchActivityTotalsForUser(username),
  ]);

  const u = combined.data.user;
  const starsReceived = await sumStars(u.repositories, username);

  return {
    fetchedAt: Date.now(),
    username,
    prsOpen,
    reviewRequested,
    issuesAssigned,
    notifications,
    starsReceived,
    commits: {
      hoje: u.hoje.totalCommitContributions,
      semana: u.semana.totalCommitContributions,
      mes: u.mes.totalCommitContributions,
      ano: u.ano.totalCommitContributions,
    },
    reviewsDone: {
      hoje: u.hoje.totalPullRequestReviewContributions,
      semana: u.semana.totalPullRequestReviewContributions,
      mes: u.mes.totalPullRequestReviewContributions,
      ano: u.ano.totalPullRequestReviewContributions,
    },
    pushes: activity.pushes,
    prComments: activity.prComments,
    inlineComments: activity.inlineComments,
  };
}

/**
 * `contributionsCollection` só aceita escopar por organização via `organizationID` (o node ID
 * da org, não o login) — por isso a resolução do ID é uma chamada GraphQL separada, antes da
 * query de contribuições em si. Se a org não existir, o próprio `gh` falha com stderr
 * "Could not resolve to an Organization..." (classificado como `not-found` em gh.ts).
 */
async function resolveOrgId(org: string): Promise<string> {
  const res = await graphql<{ data: { organization: { id: string } } }>(
    `query($org: String!) { organization(login: $org) { id } }`,
    { org },
  );
  return res.data.organization.id;
}

const ORG_CONTRIBUTIONS_QUERY = `
query($login: String!, $orgId: ID!, $todayFrom: DateTime!, $weekFrom: DateTime!, $monthFrom: DateTime!, $now: DateTime!) {
  user(login: $login) {
    hoje: contributionsCollection(from: $todayFrom, to: $now, organizationID: $orgId) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    semana: contributionsCollection(from: $weekFrom, to: $now, organizationID: $orgId) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    mes: contributionsCollection(from: $monthFrom, to: $now, organizationID: $orgId) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    ano: contributionsCollection(organizationID: $orgId) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
  }
}`;

type OrgContributionsResponse = {
  data: {
    user: {
      hoje: ContributionWindow;
      semana: ContributionWindow;
      mes: ContributionWindow;
      ano: ContributionWindow;
    };
  };
};

export type OrgPeriodContributions = {
  commits: PeriodTotals;
  reviewsDone: PeriodTotals;
};

/** Commits e reviews feitas por mim (`@me`), restritos a uma organização específica — usado por Commits e Reviews Feitas quando a tecla tem "Organização" configurada. */
export async function fetchOrgPeriodContributions(org: string): Promise<OrgPeriodContributions> {
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  const username = await resolveUsername(settings);
  const orgId = await resolveOrgId(org.trim());
  const now = new Date().toISOString();

  const res = await graphql<OrgContributionsResponse>(ORG_CONTRIBUTIONS_QUERY, {
    login: username,
    orgId,
    todayFrom: isoStartOfTodayUtc(),
    weekFrom: isoDaysAgo(7),
    monthFrom: isoDaysAgo(30),
    now,
  });

  const u = res.data.user;
  return {
    commits: {
      hoje: u.hoje.totalCommitContributions,
      semana: u.semana.totalCommitContributions,
      mes: u.mes.totalCommitContributions,
      ano: u.ano.totalCommitContributions,
    },
    reviewsDone: {
      hoje: u.hoje.totalPullRequestReviewContributions,
      semana: u.semana.totalPullRequestReviewContributions,
      mes: u.mes.totalPullRequestReviewContributions,
      ano: u.ano.totalPullRequestReviewContributions,
    },
  };
}

export type ContributionKind = "commits" | "reviewsDone";

/**
 * Limites de um dia (UTC) do mês corrente, como ISO strings — usado pra montar cada
 * `contributionsCollection(from, to)` da query diária abaixo.
 */
function utcDayBoundsIso(day: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 0, 0, 0)).toISOString();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 23, 59, 59)).toISOString();
  return { from, to };
}

/**
 * `contributionsCollection` não tem um campo nativo de série diária — só janelas arbitrárias de
 * `from`/`to`. Uma query com N aliases (`d1`, `d2`, ... um por dia já decorrido do mês, N ≤ 31)
 * resolve isso numa única chamada GraphQL, validado manualmente (`gh api graphql` com 31 aliases
 * simultâneos retorna em ~1.5s sem erro de complexidade). Bem mais barato que N chamadas
 * separadas, no mesmo espírito de `COMBINED_QUERY`/`ORG_CONTRIBUTIONS_QUERY` (aliases em vez de
 * repetir a requisição).
 */
function buildDailyContributionsQuery(dayCount: number, scoped: boolean): string {
  const orgArg = scoped ? ", organizationID: $orgId" : "";
  const fields = Array.from({ length: dayCount }, (_, i) => {
    const n = i + 1;
    return `    d${n}: contributionsCollection(from: $d${n}from, to: $d${n}to${orgArg}) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }`;
  }).join("\n");
  const varsDecl = ["$login: String!"];
  if (scoped) varsDecl.push("$orgId: ID!");
  for (let n = 1; n <= dayCount; n++) varsDecl.push(`$d${n}from: DateTime!`, `$d${n}to: DateTime!`);
  return `query(${varsDecl.join(", ")}) {\n  user(login: $login) {\n${fields}\n  }\n}`;
}

type DailyContributionsResponse = {
  data: { user: Record<string, ContributionWindow> };
};

/**
 * Série diária do mês corrente pra Commits ou Reviews Feitas (`kind` escolhe o campo):
 * 1 valor por dia já decorrido (índice 0 = dia 1, último = hoje). `orgId` opcional escopa cada
 * dia à mesma organização usada em `fetchOrgPeriodContributions`.
 */
async function fetchContributionsDailyBreakdown(kind: ContributionKind, login: string, orgId?: string): Promise<number[]> {
  const dayCount = currentUtcDayOfMonth();
  const query = buildDailyContributionsQuery(dayCount, Boolean(orgId));
  const variables: Record<string, string> = { login };
  if (orgId) variables.orgId = orgId;
  for (let n = 1; n <= dayCount; n++) {
    const { from, to } = utcDayBoundsIso(n);
    variables[`d${n}from`] = from;
    variables[`d${n}to`] = to;
  }
  const res = await graphql<DailyContributionsResponse>(query, variables);
  const user = res.data.user;
  const field = kind === "commits" ? "totalCommitContributions" : "totalPullRequestReviewContributions";
  return Array.from({ length: dayCount }, (_, i) => user[`d${i + 1}`][field]);
}

/** Série diária de commits do mês corrente; `org` opcional escopa à mesma organização de `fetchOrgPeriodContributions`. */
export async function fetchCommitsDailyBreakdown(org?: string): Promise<number[]> {
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  const login = await resolveUsername(settings);
  const orgId = org?.trim() ? await resolveOrgId(org.trim()) : undefined;
  return fetchContributionsDailyBreakdown("commits", login, orgId);
}

/** Série diária de reviews feitas do mês corrente; `org` opcional escopa à mesma organização de `fetchOrgPeriodContributions`. */
export async function fetchReviewsDoneDailyBreakdown(org?: string): Promise<number[]> {
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  const login = await resolveUsername(settings);
  const orgId = org?.trim() ? await resolveOrgId(org.trim()) : undefined;
  return fetchContributionsDailyBreakdown("reviewsDone", login, orgId);
}
