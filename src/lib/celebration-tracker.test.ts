import { beforeEach, describe, expect, it } from "vitest";
import { CelebrationTracker } from "./celebration-tracker.js";

let tracker: CelebrationTracker;

beforeEach(() => {
  tracker = new CelebrationTracker();
});

describe("CelebrationTracker", () => {
  it("primeira leitura nunca comemora — só registra a base", () => {
    expect(tracker.observe("k1", 5)).toBe(false);
  });

  it("comemora quando o valor sobe acima da base", () => {
    tracker.observe("k1", 5);
    expect(tracker.observe("k1", 7)).toBe(true);
  });

  it("não comemora quando o valor cai ou fica igual", () => {
    tracker.observe("k1", 5);
    expect(tracker.observe("k1", 5)).toBe(false);
    expect(tracker.observe("k1", 3)).toBe(false);
  });

  it("continua comemorando mesmo se o valor oscilar (sem cair abaixo da base original)", () => {
    tracker.observe("k1", 5);
    expect(tracker.observe("k1", 8)).toBe(true); // subiu, começa a comemorar
    expect(tracker.observe("k1", 6)).toBe(true); // caiu um pouco, mas ainda > base (5) — continua
    expect(tracker.observe("k1", 8)).toBe(true); // subiu de novo — continua
  });

  it("para de comemorar depois de acknowledge()", () => {
    tracker.observe("k1", 5);
    expect(tracker.observe("k1", 7)).toBe(true);
    tracker.acknowledge("k1", 7);
    expect(tracker.observe("k1", 7)).toBe(false); // 7 não é mais "acima da base", base agora é 7
  });

  it("um novo aumento depois do acknowledge comemora de novo", () => {
    tracker.observe("k1", 5);
    tracker.observe("k1", 7);
    tracker.acknowledge("k1", 7);
    expect(tracker.observe("k1", 9)).toBe(true);
  });

  it("teclas diferentes têm bases independentes", () => {
    tracker.observe("k1", 5);
    tracker.observe("k2", 100);
    expect(tracker.observe("k1", 6)).toBe(true);
    expect(tracker.observe("k2", 6)).toBe(false); // bem abaixo da base de k2 (100), não comemora
  });

  it("forget() reseta a tecla — a próxima leitura vira a nova base, sem comemorar", () => {
    tracker.observe("k1", 5);
    tracker.observe("k1", 7); // comemorando
    tracker.forget("k1");
    expect(tracker.observe("k1", 7)).toBe(false); // sem base — só registra
    expect(tracker.observe("k1", 8)).toBe(true); // agora sim, subiu de verdade
  });

  it("acknowledge sem currentValue só para de comemorar, sem mudar a base", () => {
    tracker.observe("k1", 5);
    tracker.observe("k1", 7);
    tracker.acknowledge("k1", undefined);
    // base continua 5 → 7 ainda é > 5, comemora de novo na próxima leitura
    expect(tracker.observe("k1", 7)).toBe(true);
  });
});
