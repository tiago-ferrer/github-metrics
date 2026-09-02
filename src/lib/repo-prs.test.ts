import { beforeEach, describe, expect, it, vi } from "vitest";

let mockGlobalSettings: Record<string, unknown> = {};

vi.mock("@elgato/streamdeck", () => ({
  default: {
    settings: { getGlobalSettings: vi.fn(async () => mockGlobalSettings) },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

const runGh = vi.fn(async (..._args: unknown[]) => "0");
vi.mock("./gh.js", () => ({ runGh, runGhJson: vi.fn() }));

const { fetchRepoOpenPrCount } = await import("./repo-prs.js");

beforeEach(() => {
  mockGlobalSettings = {};
  runGh.mockClear();
});

describe("fetchRepoOpenPrCount", () => {
  it("usa a organização informada como dono do repositório", async () => {
    runGh.mockResolvedValueOnce("5");
    const result = await fetchRepoOpenPrCount("cli", "minha-org");
    expect(result).toEqual({ count: 5, owner: "minha-org" });
    expect(runGh).toHaveBeenCalledWith(expect.arrayContaining(["search", "prs", "--repo=minha-org/cli", "--state=open"]));
  });

  it("sem organização, usa o githubUsername configurado como dono", async () => {
    mockGlobalSettings = { githubUsername: "ferrertiago" };
    runGh.mockResolvedValueOnce("2");
    const result = await fetchRepoOpenPrCount("meu-repo");
    expect(result).toEqual({ count: 2, owner: "ferrertiago" });
    expect(runGh).toHaveBeenCalledWith(expect.arrayContaining(["--repo=ferrertiago/meu-repo"]));
  });

  it("sem organização nem githubUsername configurado, resolve via gh api user", async () => {
    runGh.mockResolvedValueOnce("octocat").mockResolvedValueOnce("3");
    const result = await fetchRepoOpenPrCount("meu-repo");
    expect(result).toEqual({ count: 3, owner: "octocat" });
    expect(runGh).toHaveBeenNthCalledWith(1, ["api", "user", "--jq", ".login"]);
  });

  it("remove espaços extras de org e repo", async () => {
    runGh.mockResolvedValueOnce("1");
    await fetchRepoOpenPrCount("  cli  ", "  minha-org  ");
    expect(runGh).toHaveBeenCalledWith(expect.arrayContaining(["--repo=minha-org/cli"]));
  });
});
