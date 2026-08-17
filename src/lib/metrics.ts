import streamDeck from "@elgato/streamdeck";
import { runGh, runGhJson } from "./gh.js";
import type { GlobalSettings, Period } from "./settings.js";

export type PeriodTotals = Record<Period, number>;

export type MetricsSnapshot = {
  fetchedAt: number;
  username: string;
  prsOpen: number;
  reviewRequested: number;
  issuesAssigned: number;
  notifications: number;
  starsReceived: number;
  commits: PeriodTotals;
  reviewsDone: PeriodTotals;
};

async function resolveUsername(settings: GlobalSettings): Promise<string> {
  const custom = settings.githubUsername?.trim();
  if (custom) return custom;
  return runGh(["api", "user", "--jq", ".login"]);
}

async function countSearch(args: string[]): Promise<number> {
  const out = await runGh([...args, "--json", "number", "--jq", "length"]);
  return Number(out || 0);
}

async function fetchNotifications(): Promise<number> {
  const out = await runGh(["api", "notifications", "--jq", "length"]);
  return Number(out || 0);
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
    countSearch(["search", "prs", "--author=@me", "--state=open"]),
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
