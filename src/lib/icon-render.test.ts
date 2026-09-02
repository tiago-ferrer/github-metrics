import { describe, expect, it } from "vitest";
import { renderMetricIcon, renderStatusIcon } from "./icon-render.js";

describe("renderMetricIcon", () => {
  it("produz um SVG 144x144 válido com o número formatado e o rótulo", () => {
    const svg = renderMetricIcon({ glyphId: "prs-open", accent: "blue", label: "PRs", value: 7 });
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"');
    expect(svg).toContain(">7<");
    expect(svg).toContain(">PRs<");
  });

  it("compacta valores grandes (estrelas de repos populares)", () => {
    const svg = renderMetricIcon({ glyphId: "stars-received", accent: "gold", label: "★", value: 12345 });
    expect(svg).toContain(">12k<");
  });

  it("escapa a legenda (nome de org/período, texto de fora do nosso controle)", () => {
    const svg = renderMetricIcon({
      glyphId: "commits",
      accent: "cyan",
      label: "Commits",
      value: 3,
      scopeLabel: "hoje · <org>",
    });
    expect(svg).toContain("hoje · &lt;org&gt;");
    expect(svg).not.toContain("hoje · <org>");
  });

  it("mostra o texto de status (multi-linha) no lugar do número quando value é null", () => {
    const svg = renderMetricIcon({
      glyphId: "notifications",
      accent: "amber",
      label: "Notif.",
      value: null,
      statusText: "gh não\ninstalado",
    });
    expect(svg).toContain("gh não");
    expect(svg).toContain("instalado");
    expect(svg).not.toContain(">null<");
  });

  it("desenha o anel de destaque (chrome) quando strength > 0, e omite quando ausente", () => {
    const withChrome = renderMetricIcon({ glyphId: "prs-open", accent: "blue", label: "PRs", value: 1 }, { color: "#FF0000", strength: 0.8 });
    const withoutChrome = renderMetricIcon({ glyphId: "prs-open", accent: "blue", label: "PRs", value: 1 });
    expect(withChrome).toContain("#FF0000");
    expect(withoutChrome).not.toContain("#FF0000");
    // "rx=\"21.4\"" é o raio do anel externo do chrome — só aparece quando o efeito está ativo.
    expect(withChrome).toContain('rx="21.4"');
    expect(withoutChrome).not.toContain('rx="21.4"');
  });
});

describe("renderStatusIcon", () => {
  it("usa verde quando ok e vermelho quando não", () => {
    const ok = renderStatusIcon({ ok: true, label: "OK" });
    const error = renderStatusIcon({ ok: false, label: "gh sem\nlogin" });
    expect(ok).toContain("#4ADE80");
    expect(error).toContain("#FF6B6B");
  });
});
