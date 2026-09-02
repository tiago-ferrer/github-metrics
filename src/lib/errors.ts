import { GhError, type GhErrorKind } from "./gh.js";

/** Rótulos curtos (1–2 linhas) por tipo de erro — desenhados dentro do ícone dinâmico no lugar do número (PLANO.md §6). */
const ERROR_LABELS: Record<GhErrorKind, string> = {
  "not-installed": "gh não\ninstalado",
  "not-authenticated": "gh sem\nlogin",
  "rate-limited": "Rate\nlimit",
  network: "Sem\nconexão",
  "not-found": "Org/repo\ninexistente",
  unknown: "Erro",
};

export function errorLabel(error: unknown): string {
  return error instanceof GhError ? ERROR_LABELS[error.kind] : ERROR_LABELS.unknown;
}
