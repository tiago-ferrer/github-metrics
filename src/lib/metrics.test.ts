import { beforeEach, describe, expect, it, vi } from "vitest";

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
  fetchOrgScopedPrsOpen,
  fetchOrgScopedReviewRequested,
  fetchOrgScopedIssuesAssigned,
  fetchOrgScopedNotifications,
  fetchOrgPeriodContributions,
} = await import("./metrics.js");

beforeEach(() => {
  mockGlobalSettings = { githubUsername: "octocat" };
  runGh.mockReset().mockResolvedValue("3");
  runGhJson.mockReset().mockResolvedValue({});
});

describe("métricas pessoais escopadas por organização (buscas)", () => {
  it("PRs abertas: mantém --author=@me e soma --owner", async () => {
    await fetchOrgScopedPrsOpen("minha-org");
    expect(runGh).toHaveBeenCalledWith(
      expect.arrayContaining(["search", "prs", "--author=@me", "--state=open", "--owner=minha-org"]),
    );
  });

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
    await fetchOrgScopedPrsOpen("  minha-org  ");
    expect(runGh).toHaveBeenCalledWith(expect.arrayContaining(["--owner=minha-org"]));
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
