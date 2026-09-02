import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockGlobalSettings: Record<string, unknown> = {};

vi.mock("@elgato/streamdeck", () => ({
  default: {
    settings: { getGlobalSettings: vi.fn(async () => mockGlobalSettings) },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

const runGh = vi.fn(async (..._args: unknown[]) => "0");
const runGhJson = vi.fn(async (..._args: unknown[]): Promise<unknown> => ({}));
vi.mock("./gh.js", () => ({ runGh, runGhJson }));

const {
  fetchOrgScopedReviewRequested,
  fetchOrgScopedIssuesAssigned,
  fetchOrgScopedNotifications,
  fetchOrgPeriodContributions,
  fetchPrsOpenByPeriod,
  fetchOrgPrsOpenByPeriod,
  fetchActivityTotalsForUser,
  fetchOrgActivityTotals,
  fetchPrsOpenDailyBreakdown,
  fetchActivityDailyBreakdown,
  fetchCommitsDailyBreakdown,
  fetchReviewsDoneDailyBreakdown,
} = await import("./metrics.js");

beforeEach(() => {
  mockGlobalSettings = { githubUsername: "octocat" };
  runGh.mockReset().mockResolvedValue("3");
  runGhJson.mockReset().mockResolvedValue({});
});

describe("métricas pessoais escopadas por organização (buscas)", () => {
  it("Review solicitada: mantém --review-requested=@me e soma --owner", async () => {
    await fetchOrgScopedReviewRequested("minha-org");
    expect(runGh).toHaveBeenCalledWith(
      expect.arrayContaining(["search", "prs", "--review-requested=@me", "--state=open", "--owner=minha-org"]),
    );
  });

  it("Issues atribuídas: mantém --assignee=@me e soma --owner", async () => {
    await fetchOrgScopedIssuesAssigned("minha-org");
    expect(runGh).toHaveBeenCalledWith(
      expect.arrayContaining(["search", "issues", "--assignee=@me", "--state=open", "--owner=minha-org"]),
    );
  });

  it("remove espaços extras do nome da org", async () => {
    await fetchOrgScopedReviewRequested("  minha-org  ");
    expect(runGh).toHaveBeenCalledWith(expect.arrayContaining(["--owner=minha-org"]));
  });
});

describe("fetchPrsOpenByPeriod / fetchOrgPrsOpenByPeriod", () => {
  /**
   * A API de busca do GitHub tem um limite bem mais apertado (30 req/min) que o resto — por
   * isso isto busca só a janela mais larga (1 chamada) e conta hoje/semana/mês no lado do
   * cliente a partir do `createdAt` de cada item, em vez de 1 chamada por janela.
   */
  function itemsAt(...daysAgo: number[]) {
    const now = Date.now();
    return daysAgo.map((d) => ({ createdAt: new Date(now - d * 24 * 3600 * 1000).toISOString() }));
  }

  it("faz UMA chamada só (não 4) e conta hoje/semana/mês/ano no cliente pelo createdAt", async () => {
    runGhJson.mockResolvedValueOnce(itemsAt(0, 3, 15, 100));

    const totals = await fetchPrsOpenByPeriod();

    expect(totals).toEqual({ hoje: 1, semana: 2, mes: 3, ano: 4 });
    expect(runGhJson).toHaveBeenCalledTimes(1);
    const args = runGhJson.mock.calls[0]?.[0] as string[];
    expect(args).toEqual(expect.arrayContaining(["search", "prs", "--author=@me", "--state=open", "--limit=1000", "--json", "createdAt"]));
    expect(args.some((a) => a.startsWith("--created=>="))).toBe(true);
    expect(args.some((a) => a.startsWith("--owner="))).toBe(false);
  });

  it("versão escopada por organização soma --owner na única chamada", async () => {
    runGhJson.mockResolvedValueOnce(itemsAt(0));
    await fetchOrgPrsOpenByPeriod("minha-org");
    expect(runGhJson).toHaveBeenCalledTimes(1);
    expect(runGhJson.mock.calls[0]?.[0] as string[]).toEqual(expect.arrayContaining(["--owner=minha-org"]));
  });
});

describe("fetchOrgScopedNotifications", () => {
  it("soma todas as páginas e filtra pelo owner do repositório", async () => {
    runGhJson.mockResolvedValueOnce([
      [{ repository: { owner: { login: "minha-org" } } }, { repository: { owner: { login: "outra-org" } } }],
      [{ repository: { owner: { login: "minha-org" } } }],
    ]);
    await expect(fetchOrgScopedNotifications("minha-org")).resolves.toBe(2);
    expect(runGhJson).toHaveBeenCalledWith(["api", "notifications", "--paginate", "--slurp"]);
  });

  it("retorna 0 quando nenhuma notificação é da org", async () => {
    runGhJson.mockResolvedValueOnce([[{ repository: { owner: { login: "outra-org" } } }]]);
    await expect(fetchOrgScopedNotifications("minha-org")).resolves.toBe(0);
  });
});

describe("fetchActivityTotalsForUser / fetchOrgActivityTotals (pushes/comentários via Events API)", () => {
  const now = Date.now();
  const daysAgoIso = (d: number) => new Date(now - d * 24 * 3600 * 1000).toISOString();

  /** Formatos reais confirmados via `gh api users/<login>/events` antes de implementar. */
  function fakeEvents() {
    return [
      { type: "PushEvent", created_at: daysAgoIso(0), repo: { name: "octocat/repo-a" } },
      { type: "PushEvent", created_at: daysAgoIso(15), repo: { name: "octocat/repo-b" } },
      // comentário de PR de verdade: IssueCommentEvent com payload.issue.pull_request presente
      { type: "IssueCommentEvent", created_at: daysAgoIso(3), repo: { name: "octocat/repo-a" }, payload: { issue: { pull_request: { url: "x" } } } },
      // comentário de issue comum (sem pull_request) — não deve contar como "PR Comments"
      { type: "IssueCommentEvent", created_at: daysAgoIso(1), repo: { name: "octocat/repo-a" }, payload: { issue: {} } },
      { type: "PullRequestReviewCommentEvent", created_at: daysAgoIso(2), repo: { name: "octocat/repo-a" } },
      { type: "PullRequestReviewCommentEvent", created_at: daysAgoIso(60), repo: { name: "outra-org/outro-repo" } },
      // tipo de evento sem relação nenhuma — deve ser ignorado por completo
      { type: "WatchEvent", created_at: daysAgoIso(0), repo: { name: "octocat/repo-a" } },
    ];
  }

  it("conta pushes, comentários de PR (não de issue comum) e comentários em linha, por período", async () => {
    runGhJson.mockResolvedValueOnce(fakeEvents());

    const totals = await fetchActivityTotalsForUser("octocat");

    expect(totals.pushes).toEqual({ hoje: 1, semana: 1, mes: 2, ano: 2 });
    expect(totals.prComments).toEqual({ hoje: 0, semana: 1, mes: 1, ano: 1 }); // só o com pull_request
    expect(totals.inlineComments).toEqual({ hoje: 0, semana: 1, mes: 1, ano: 2 });
    expect(runGhJson).toHaveBeenCalledWith(["api", "users/octocat/events", "--paginate"]);
  });

  it("versão escopada por organização filtra pelo dono do repositório (repo.name começa com 'org/')", async () => {
    runGhJson.mockResolvedValueOnce(fakeEvents());

    const totals = await fetchOrgActivityTotals("outra-org");

    // só o PullRequestReviewCommentEvent de "outra-org/outro-repo" (60 dias atrás) bate
    expect(totals.inlineComments).toEqual({ hoje: 0, semana: 0, mes: 0, ano: 1 });
    expect(totals.pushes).toEqual({ hoje: 0, semana: 0, mes: 0, ano: 0 });
  });
});

describe("fetchOrgPeriodContributions", () => {
  it("resolve o ID da org antes de buscar commits/reviews e mapeia os 4 períodos", async () => {
    runGhJson
      .mockResolvedValueOnce({ data: { organization: { id: "ORG_ID_123" } } })
      .mockResolvedValueOnce({
        data: {
          user: {
            hoje: { totalCommitContributions: 1, totalPullRequestReviewContributions: 2 },
            semana: { totalCommitContributions: 3, totalPullRequestReviewContributions: 4 },
            mes: { totalCommitContributions: 5, totalPullRequestReviewContributions: 6 },
            ano: { totalCommitContributions: 7, totalPullRequestReviewContributions: 8 },
          },
        },
      });

    const result = await fetchOrgPeriodContributions("minha-org");

    expect(result).toEqual({
      commits: { hoje: 1, semana: 3, mes: 5, ano: 7 },
      reviewsDone: { hoje: 2, semana: 4, mes: 6, ano: 8 },
    });

    const [resolveIdArgs, contributionsArgs] = runGhJson.mock.calls.map((call) => call[0] as string[]);
    expect(resolveIdArgs).toEqual(expect.arrayContaining(["-F", "org=minha-org"]));
    expect(contributionsArgs).toEqual(expect.arrayContaining(["-F", "orgId=ORG_ID_123", "-F", "login=octocat"]));
  });
});

describe("fetchPrsOpenDailyBreakdown (gráfico de barras — PRs Abertas)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("agrupa por dia do mês corrente (1 posição por dia já decorrido) e ignora o mês anterior", async () => {
    runGhJson.mockResolvedValueOnce([
      { createdAt: "2026-09-01T10:00:00Z" },
      { createdAt: "2026-09-01T11:00:00Z" },
      { createdAt: "2026-09-15T08:00:00Z" },
      { createdAt: "2026-08-31T23:00:00Z" }, // mês anterior — não deve contar
    ]);

    const counts = await fetchPrsOpenDailyBreakdown();

    expect(counts).toHaveLength(15); // dia 15 = "hoje" no relógio congelado acima
    expect(counts[0]).toBe(2); // dia 1
    expect(counts[14]).toBe(1); // dia 15 (hoje)
    expect(counts.slice(1, 14).every((c) => c === 0)).toBe(true);
    const args = runGhJson.mock.calls[0]?.[0] as string[];
    expect(args).toEqual(expect.arrayContaining(["search", "prs", "--author=@me", "--state=open", "--created=>=2026-09-01T00:00:00.000Z"]));
  });

  it("versão escopada por organização soma --owner", async () => {
    runGhJson.mockResolvedValueOnce([]);
    await fetchPrsOpenDailyBreakdown("minha-org");
    expect(runGhJson.mock.calls[0]?.[0] as string[]).toEqual(expect.arrayContaining(["--owner=minha-org"]));
  });
});

describe("fetchActivityDailyBreakdown (gráfico de barras — Pushes/PR Comments/Inline Comments)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("agrupa pushes por dia do mês corrente, resolvendo o username sozinho", async () => {
    runGhJson.mockResolvedValueOnce([
      { type: "PushEvent", created_at: "2026-09-15T09:00:00Z", repo: { name: "octocat/repo-a" } },
      { type: "PushEvent", created_at: "2026-09-01T09:00:00Z", repo: { name: "octocat/repo-a" } },
      { type: "PushEvent", created_at: "2026-08-30T09:00:00Z", repo: { name: "octocat/repo-a" } }, // mês anterior
      { type: "IssueCommentEvent", created_at: "2026-09-15T09:00:00Z", repo: { name: "octocat/repo-a" } }, // tipo errado
    ]);

    const counts = await fetchActivityDailyBreakdown("pushes");

    expect(counts).toHaveLength(15);
    expect(counts[0]).toBe(1);
    expect(counts[14]).toBe(1);
    expect(runGhJson).toHaveBeenCalledWith(["api", "users/octocat/events", "--paginate"]);
  });

  it("filtra por organização (dono do repositório)", async () => {
    runGhJson.mockResolvedValueOnce([
      { type: "PushEvent", created_at: "2026-09-15T09:00:00Z", repo: { name: "minha-org/repo-a" } },
      { type: "PushEvent", created_at: "2026-09-15T09:05:00Z", repo: { name: "outra-org/repo-b" } },
    ]);
    const counts = await fetchActivityDailyBreakdown("pushes", "minha-org");
    expect(counts[14]).toBe(1);
  });
});

describe("fetchCommitsDailyBreakdown / fetchReviewsDoneDailyBreakdown (gráfico de barras via GraphQL)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00Z")); // dia 3 — query pequena, fácil de conferir
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("monta 1 alias por dia já decorrido e extrai o campo certo de cada dia", async () => {
    runGhJson.mockResolvedValueOnce({
      data: {
        user: {
          d1: { totalCommitContributions: 2, totalPullRequestReviewContributions: 0 },
          d2: { totalCommitContributions: 0, totalPullRequestReviewContributions: 1 },
          d3: { totalCommitContributions: 5, totalPullRequestReviewContributions: 3 },
        },
      },
    });

    const counts = await fetchCommitsDailyBreakdown();

    expect(counts).toEqual([2, 0, 5]);
    const args = runGhJson.mock.calls[0]?.[0] as string[];
    const queryArg = args.find((a) => a.startsWith("query=")) ?? "";
    expect(queryArg).toContain("d1: contributionsCollection");
    expect(queryArg).toContain("d3: contributionsCollection");
    expect(queryArg).not.toContain("organizationID");
    expect(args).toEqual(expect.arrayContaining(["-F", "d1from=2026-09-01T00:00:00.000Z", "-F", "d3to=2026-09-03T23:59:59.000Z"]));
  });

  it("com organização, resolve o orgId antes e escopa cada dia por organizationID", async () => {
    runGhJson
      .mockResolvedValueOnce({ data: { organization: { id: "ORG_ID_9" } } })
      .mockResolvedValueOnce({
        data: {
          user: {
            d1: { totalCommitContributions: 0, totalPullRequestReviewContributions: 1 },
            d2: { totalCommitContributions: 0, totalPullRequestReviewContributions: 0 },
            d3: { totalCommitContributions: 0, totalPullRequestReviewContributions: 2 },
          },
        },
      });

    const counts = await fetchReviewsDoneDailyBreakdown("minha-org");

    expect(counts).toEqual([1, 0, 2]);
    const contributionsArgs = runGhJson.mock.calls[1]?.[0] as string[];
    expect(contributionsArgs).toEqual(expect.arrayContaining(["-F", "orgId=ORG_ID_9"]));
    const queryArg = contributionsArgs.find((a) => a.startsWith("query=")) ?? "";
    expect(queryArg).toContain("organizationID: $orgId");
  });
});
