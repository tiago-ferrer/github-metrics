import { describe, expect, it, vi } from "vitest";

const runGh = vi.fn(async () => "3");

vi.mock("@elgato/streamdeck", () => ({
  default: {
    settings: { getGlobalSettings: vi.fn(async () => ({})) },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));
vi.mock("./gh.js", () => ({ runGh, runGhJson: vi.fn() }));

const { fetchOrgOpenPrCount } = await import("./org-prs.js");

describe("fetchOrgOpenPrCount", () => {
  it("busca por owner (org inteira) quando repo não é informado", async () => {
    await fetchOrgOpenPrCount("minha-org");
    expect(runGh).toHaveBeenCalledWith(expect.arrayContaining(["search", "prs", "--owner=minha-org", "--state=open"]));
  });

  it("busca por repo (org/repo) quando repo é informado", async () => {
    await fetchOrgOpenPrCount("minha-org", "meu-repo");
    expect(runGh).toHaveBeenCalledWith(
      expect.arrayContaining(["search", "prs", "--repo=minha-org/meu-repo", "--state=open"]),
    );
  });

  it("remove espaços extras de org e repo", async () => {
    await fetchOrgOpenPrCount("  minha-org  ", "  meu-repo  ");
    expect(runGh).toHaveBeenCalledWith(
      expect.arrayContaining(["search", "prs", "--repo=minha-org/meu-repo", "--state=open"]),
    );
  });

  it("aplica --limit=1000 para evitar subcontagem em orgs grandes", async () => {
    await fetchOrgOpenPrCount("minha-org");
    expect(runGh).toHaveBeenCalledWith(expect.arrayContaining(["--limit=1000"]));
  });

  it("retorna o número parseado da saída do gh", async () => {
    await expect(fetchOrgOpenPrCount("minha-org")).resolves.toBe(3);
  });
});
