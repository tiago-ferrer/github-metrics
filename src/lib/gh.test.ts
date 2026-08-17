import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(dirname, "__fixtures__", name);

let mockGlobalSettings: Record<string, unknown> = {};

vi.mock("@elgato/streamdeck", () => ({
  default: {
    settings: {
      getGlobalSettings: vi.fn(async () => mockGlobalSettings),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

const { runGh, GhError } = await import("./gh.js");

beforeEach(() => {
  mockGlobalSettings = {};
});

/**
 * Exercita a classificação de erro de verdade (não é um mock do resultado — é o `gh.ts`
 * real chamando um script `gh` falso via execFile) para os 4 cenários do PLANO.md §6.
 */
describe("runGh — classificação de erros", () => {
  it("retorna a saída quando o gh funciona", async () => {
    mockGlobalSettings = { ghBinaryPath: fixture("gh-ok.sh") };
    await expect(runGh(["qualquer", "coisa"])).resolves.toBe("42");
  });

  it("classifica como not-installed quando o binário não existe", async () => {
    mockGlobalSettings = { ghBinaryPath: "/caminho/que/definitivamente/nao/existe/gh" };
    await expect(runGh(["qualquer"])).rejects.toMatchObject({ kind: "not-installed" });
  });

  it("classifica como not-authenticated", async () => {
    mockGlobalSettings = { ghBinaryPath: fixture("gh-not-authenticated.sh") };
    await expect(runGh(["auth", "status"])).rejects.toMatchObject({ kind: "not-authenticated" });
  });

  it("classifica como rate-limited", async () => {
    mockGlobalSettings = { ghBinaryPath: fixture("gh-rate-limited.sh") };
    await expect(runGh(["api", "user"])).rejects.toMatchObject({ kind: "rate-limited" });
  });

  it("classifica como network", async () => {
    mockGlobalSettings = { ghBinaryPath: fixture("gh-network-error.sh") };
    await expect(runGh(["api", "user"])).rejects.toMatchObject({ kind: "network" });
  });

  it("classifica como unknown quando não reconhece o padrão", async () => {
    mockGlobalSettings = { ghBinaryPath: fixture("gh-unknown-error.sh") };
    await expect(runGh(["api", "user"])).rejects.toMatchObject({ kind: "unknown" });
  });

  it("todos os erros são instâncias de GhError", async () => {
    mockGlobalSettings = { ghBinaryPath: fixture("gh-unknown-error.sh") };
    await expect(runGh(["api", "user"])).rejects.toBeInstanceOf(GhError);
  });
});
