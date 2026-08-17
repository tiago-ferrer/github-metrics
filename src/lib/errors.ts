import type { KeyAction } from "@elgato/streamdeck";
import { GhError, type GhErrorKind } from "./gh.js";

/** Rótulos curtos (cabem no título de uma tecla) por tipo de erro — PLANO.md §6. */
const ERROR_LABELS: Record<GhErrorKind, string> = {
  "not-installed": "gh não\ninstalado",
  "not-authenticated": "gh sem\nlogin",
  "rate-limited": "Rate\nlimit",
  network: "Sem\nconexão",
  unknown: "Erro",
};

export function errorLabel(error: unknown): string {
  return error instanceof GhError ? ERROR_LABELS[error.kind] : ERROR_LABELS.unknown;
}

/** Aplica o feedback visual padrão de erro numa action (título curto + alerta). */
export async function reportError(action: KeyAction, error: unknown): Promise<void> {
  await action.setTitle(errorLabel(error));
  await action.showAlert();
}
