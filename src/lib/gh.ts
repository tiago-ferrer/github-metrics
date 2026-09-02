import { execFile } from "node:child_process";
import { promisify } from "node:util";
import streamDeck from "@elgato/streamdeck";
import type { GlobalSettings } from "./settings.js";

const execFileAsync = promisify(execFile);

/**
 * Categorias de falha ao chamar o `gh`, usadas para decidir o que mostrar na action
 * (ver PLANO.md §6 — Tratamento de erros).
 */
export type GhErrorKind = "not-installed" | "not-authenticated" | "rate-limited" | "network" | "not-found" | "unknown";

export class GhError extends Error {
  readonly kind: GhErrorKind;

  constructor(message: string, kind: GhErrorKind, cause?: unknown) {
    super(message, { cause });
    this.name = "GhError";
    this.kind = kind;
  }
}

/**
 * No Windows, quando o comando é um nome "solto" (ex.: "gh"), o libuv já resolve a extensão
 * certa via PATH + PATHEXT automaticamente — mesmo sem shell. Mas quando o usuário informa um
 * caminho explícito (contém separador de diretório) sem extensão, o Windows NÃO faz essa busca
 * de extensão (isso só vale para lookup por PATH) e a chamada falha com ENOENT mesmo que
 * `gh.exe` exista ali. Ver PLANO.md §9 (risco: localização do gh no PATH no Windows).
 */
export function normalizeGhBinaryPath(customPath: string, platform: NodeJS.Platform = process.platform): string {
  if (platform !== "win32") return customPath;
  const looksLikeExplicitPath = /[\\/]/.test(customPath);
  const hasExtension = /\.[a-z0-9]+$/i.test(customPath);
  return looksLikeExplicitPath && !hasExtension ? `${customPath}.exe` : customPath;
}

async function resolveGhBinary(): Promise<string> {
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  const custom = settings.ghBinaryPath?.trim();
  if (!custom) return "gh";
  return normalizeGhBinaryPath(custom);
}

/**
 * Diretórios comuns de instalação do `gh` no macOS via Homebrew (Apple Silicon e Intel). O app
 * Stream Deck lança o plugin como processo GUI (via Launch Services), que **não herda o PATH do
 * shell do usuário** (`~/.zprofile`/`~/.zshrc` só rodam em sessões de shell interativas) — por
 * isso `gh` instalado via Homebrew não é encontrado mesmo estando instalado e autenticado no
 * terminal, e a action mostra "gh não instalado" incorretamente. Complementa (não substitui)
 * `ghBinaryPath`: aqui só ajuda a resolver `gh` pelo nome "solto" via PATH.
 */
const COMMON_GH_DIRS = ["/opt/homebrew/bin", "/usr/local/bin"];

export function buildEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  if (platform !== "darwin") return { ...baseEnv, NO_COLOR: "1" };
  const existingDirs = (baseEnv.PATH ?? "").split(":").filter(Boolean);
  const missingDirs = COMMON_GH_DIRS.filter((dir) => !existingDirs.includes(dir));
  const path = [...existingDirs, ...missingDirs].join(":");
  return { ...baseEnv, PATH: path, NO_COLOR: "1" };
}

function classifyError(err: unknown): GhError {
  const nodeErr = err as { code?: string; killed?: boolean; stderr?: string; message?: string };

  if (nodeErr?.code === "ENOENT") {
    return new GhError("gh CLI não encontrado no PATH.", "not-installed", err);
  }

  const stderr = nodeErr?.stderr ?? "";
  if (/gh auth login|not logged into|authentication/i.test(stderr)) {
    return new GhError("gh não está autenticado (rode `gh auth login`).", "not-authenticated", err);
  }
  if (/rate limit/i.test(stderr)) {
    return new GhError("Rate limit da API do GitHub excedido.", "rate-limited", err);
  }
  if (/could not resolve to a[n]? (organization|repository|user|project)/i.test(stderr)) {
    return new GhError("Organização ou repositório não encontrado.", "not-found", err);
  }
  if (/could not resolve host|network is unreachable|timed? ?out/i.test(stderr) || nodeErr?.killed) {
    return new GhError("Sem conexão com a internet ou GitHub indisponível.", "network", err);
  }
  return new GhError(stderr || nodeErr?.message || "Erro desconhecido ao executar gh.", "unknown", err);
}

/**
 * Executa `gh` com os argumentos informados via execFile (nunca via shell — evita
 * shell injection, já que parte do input pode vir das settings configuradas pelo usuário).
 */
export async function runGh(args: string[], options: { timeoutMs?: number } = {}): Promise<string> {
  const bin = await resolveGhBinary();
  try {
    const { stdout } = await execFileAsync(bin, args, {
      timeout: options.timeoutMs ?? 15_000,
      maxBuffer: 10 * 1024 * 1024,
      env: buildEnv(process.env),
    });
    return stdout.trim();
  } catch (err) {
    throw classifyError(err);
  }
}

/** Variante de {@link runGh} que faz `JSON.parse` da saída (usada com `--jq`/`gh api graphql`). */
export async function runGhJson<T = unknown>(args: string[], options: { timeoutMs?: number } = {}): Promise<T> {
  const out = await runGh(args, options);
  if (!out) return undefined as T;
  return JSON.parse(out) as T;
}
