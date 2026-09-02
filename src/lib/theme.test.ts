import { describe, expect, it } from "vitest";
import { escapeXml, formatCount } from "./theme.js";

describe("formatCount", () => {
  it("mostra números pequenos como estão", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(42)).toBe("42");
    expect(formatCount(999)).toBe("999");
  });

  it("compacta milhares com 'k'", () => {
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1234)).toBe("1.2k");
    expect(formatCount(12345)).toBe("12k");
    expect(formatCount(99999)).toBe("100k");
  });

  it("compacta milhões com 'M'", () => {
    expect(formatCount(1_234_000)).toBe("1.2M");
    expect(formatCount(12_000_000)).toBe("12M");
  });
});

describe("escapeXml", () => {
  it("escapa os caracteres especiais de XML", () => {
    expect(escapeXml(`<tag> & 'aspas' "duplas"`)).toBe("&lt;tag&gt; &amp; &apos;aspas&apos; &quot;duplas&quot;");
  });

  it("não mexe em texto normal", () => {
    expect(escapeXml("fiap-2tdsps-2026")).toBe("fiap-2tdsps-2026");
  });
});
