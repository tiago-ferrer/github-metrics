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

const { runGh, GhError, normalizeGhBinaryPath } = await import("./gh.js");

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

  it("classifica como not-found quando a organização/repositório não existe", async () => {
    mockGlobalSettings = { ghBinaryPath: fixture("gh-not-found.sh") };
    await expect(runGh(["api", "graphql"])).rejects.toMatchObject({ kind: "not-found" });
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

/**
 * PLANO.md §9 — no Windows, um caminho explícito (com separador) sem extensão NÃO é resolvido
 * via PATHEXT pelo Windows (isso só vale para nome de comando "solto" via PATH), então precisa
 * do ".exe" anexado manualmente. Testado explicitamente para win32 e macOS/Linux (sem alterar
 * process.platform de verdade — o parâmetro é injetável).
 */
describe("normalizeGhBinaryPath — compatibilidade Windows", () => {
  it("anexa .exe a um caminho explícito sem extensão no Windows", () => {
    expect(normalizeGhBinaryPath("C:\\Program Files\\GitHub CLI\\gh", "win32")).toBe(
      "C:\\Program Files\\GitHub CLI\\gh.exe",
    );
  });

  it("não mexe em caminho que já tem extensão no Windows", () => {
    expect(normalizeGhBinaryPath("C:\\Program Files\\GitHub CLI\\gh.exe", "win32")).toBe(
      "C:\\Program Files\\GitHub CLI\\gh.exe",
    );
  });

  it("não mexe em comando solto (sem separador) no Windows — resolvido via PATH/PATHEXT pelo libuv", () => {
    expect(normalizeGhBinaryPath("gh", "win32")).toBe("gh");
  });

  it("não altera nada fora do Windows", () => {
    expect(normalizeGhBinaryPath("/usr/local/bin/gh", "darwin")).toBe("/usr/local/bin/gh");
    expect(normalizeGhBinaryPath("/usr/local/bin/gh", "linux")).toBe("/usr/local/bin/gh");
  });
});
