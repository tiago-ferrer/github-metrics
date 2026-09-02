import { describe, expect, it } from "vitest";
import { DEFAULT_REFRESH_INTERVAL_SECONDS, MIN_REFRESH_INTERVAL_SECONDS, refreshIntervalMs, resolvePeriod } from "./settings.js";

describe("refreshIntervalMs", () => {
  it("usa o default quando não configurado", () => {
    expect(refreshIntervalMs({})).toBe(DEFAULT_REFRESH_INTERVAL_SECONDS * 1000);
  });

  it("respeita um valor configurado acima do mínimo", () => {
    expect(refreshIntervalMs({ refreshIntervalSeconds: 90 })).toBe(90_000);
  });

  it("aplica o piso mínimo mesmo se o usuário configurar um valor menor", () => {
    expect(refreshIntervalMs({ refreshIntervalSeconds: 5 })).toBe(MIN_REFRESH_INTERVAL_SECONDS * 1000);
  });

  it("cai no default quando o valor salvo é NaN (nunca deixa passar pro setInterval)", () => {
    expect(refreshIntervalMs({ refreshIntervalSeconds: NaN })).toBe(DEFAULT_REFRESH_INTERVAL_SECONDS * 1000);
  });

  it("cai no default quando o valor salvo é Infinity", () => {
    expect(refreshIntervalMs({ refreshIntervalSeconds: Infinity })).toBe(DEFAULT_REFRESH_INTERVAL_SECONDS * 1000);
  });

  it("cai no default quando o valor salvo não é um número", () => {
    expect(refreshIntervalMs({ refreshIntervalSeconds: "60" as unknown as number })).toBe(DEFAULT_REFRESH_INTERVAL_SECONDS * 1000);
  });
});

describe("resolvePeriod", () => {
  it('usa "hoje" como padrão', () => {
    expect(resolvePeriod({})).toBe("hoje");
  });

  it("respeita o período configurado", () => {
    expect(resolvePeriod({ period: "ano" })).toBe("ano");
  });
});
