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

async function fetchPrsOpenCount(createdFrom: string, owner?: string): Promise<number> {
  const args = ["search", "prs", "--author=@me", "--state=open", `--created=>=${createdFrom}`];
  if (owner) args.push(`--owner=${owner}`);
  return countSearch(args);
}

/**
 * PRs abertas por mim (`@me`) criadas dentro de cada janela de tempo e que ainda estão abertas
 * agora — não é "todas as PRs abertas agora" (isso não combina com período: uma PR pode estar
 * aberta há meses). `ano` usa uma janela literal de 365 dias, já que aqui não tem o mesmo "from
 * omitido = ano corrido" que o GraphQL do `contributionsCollection` oferece.
 */
async function fetchPrsOpenPeriodTotals(owner?: string): Promise<PeriodTotals> {
  const [hoje, semana, mes, ano] = await Promise.all([
    fetchPrsOpenCount(isoStartOfTodayUtc(), owner),
    fetchPrsOpenCount(isoDaysAgo(7), owner),
    fetchPrsOpenCount(isoDaysAgo(30), owner),
    fetchPrsOpenCount(isoDaysAgo(365), owner),
  ]);
  return { hoje, semana, mes, ano };
}

/** PRs abertas por mim, por período, em toda a conta pessoal (usado pelo poller central). */
export async function fetchPrsOpenByPeriod(): Promise<PeriodTotals> {
  return fetchPrsOpenPeriodTotals();
}

/** PRs abertas por mim, por período, restritas aos repositórios de uma organização específica. */
export async function fetchOrgPrsOpenByPeriod(org: string): Promise<PeriodTotals> {
  return fetchPrsOpenPeriodTotals(org.trim());
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

  const [prsOpen, reviewRequested, issuesAssigned, notifications, combined] = await Promise.all([
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
