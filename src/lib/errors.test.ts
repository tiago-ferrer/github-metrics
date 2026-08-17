import { describe, expect, it, vi } from "vitest";
import type { KeyAction } from "@elgato/streamdeck";
import { errorLabel, reportError } from "./errors.js";
import { GhError, type GhErrorKind } from "./gh.js";

describe("errorLabel", () => {
  const cases: [GhErrorKind, string][] = [
    ["not-installed", "gh não\ninstalado"],
    ["not-authenticated", "gh sem\nlogin"],
    ["rate-limited", "Rate\nlimit"],
    ["network", "Sem\nconexão"],
    ["unknown", "Erro"],
  ];

  it.each(cases)("mapeia %s", (kind, label) => {
    expect(errorLabel(new GhError("msg", kind))).toBe(label);
  });

  it("erros que não são GhError caem no rótulo genérico", () => {
    expect(errorLabel(new Error("boom"))).toBe("Erro");
  });
});

describe("reportError", () => {
  it("seta o título com o rótulo do erro e dispara showAlert", async () => {
    const action = { setTitle: vi.fn(), showAlert: vi.fn() } as unknown as KeyAction;
    await reportError(action, new GhError("msg", "rate-limited"));
    expect(action.setTitle).toHaveBeenCalledWith("Rate\nlimit");
    expect(action.showAlert).toHaveBeenCalledTimes(1);
  });
});
