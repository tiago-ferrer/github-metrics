import { describe, expect, it } from "vitest";
import { errorLabel } from "./errors.js";
import { GhError, type GhErrorKind } from "./gh.js";

describe("errorLabel", () => {
  const cases: [GhErrorKind, string][] = [
    ["not-installed", "gh não\ninstalado"],
    ["not-authenticated", "gh sem\nlogin"],
    ["rate-limited", "Rate\nlimit"],
    ["network", "Sem\nconexão"],
    ["not-found", "Org/repo\ninexistente"],
    ["unknown", "Erro"],
  ];

  it.each(cases)("mapeia %s", (kind, label) => {
    expect(errorLabel(new GhError("msg", kind))).toBe(label);
  });

  it("erros que não são GhError caem no rótulo genérico", () => {
    expect(errorLabel(new Error("boom"))).toBe("Erro");
  });
});
