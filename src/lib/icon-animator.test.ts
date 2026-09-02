import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@elgato/streamdeck", () => ({ default: { logger } }));

const { iconAnimator } = await import("./icon-animator.js");

function fakeAction() {
  const calls: string[] = [];
  return {
    action: { setImage: vi.fn(async (svg?: string) => void calls.push(svg ?? "")) },
    calls,
  };
}

/** `safeSetImage` sempre empacota como data URI base64 — decodifica de volta pra comparar o conteúdo. */
function decodeDataUri(dataUri: string): string {
  const base64 = dataUri.replace(/^data:image\/svg\+xml;base64,/, "");
  return Buffer.from(base64, "base64").toString("utf-8");
}

beforeEach(() => {
  vi.useFakeTimers();
  logger.error.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("iconAnimator — pulse (efeito único, decai e para sozinho)", () => {
  it("desenha imediatamente com strength 1 e decai até sumir", async () => {
    const { action } = fakeAction();
    iconAnimator.pulse("k1", action, (strength) => `strength=${strength.toFixed(2)}`);

    // frame imediato, síncrono no registro (strength ~1)
    expect(decodeDataUri(action.setImage.mock.calls[0]?.[0] as string)).toBe("strength=1.00");

    // +150ms de margem sobre a duração nominal: o pulso só é removido no primeiro tick do
    // interval (a cada 90ms) em que o progresso já bateu 1 — sem margem, avançar exatamente a
    // duração nominal pode cair um tick antes disso.
    await vi.advanceTimersByTimeAsync(1100 + 150);
    const lastCall = decodeDataUri(action.setImage.mock.calls.at(-1)?.[0] as string);
    expect(lastCall).toMatch(/strength=0\.0[0-2]/);
  });

  it("para de chamar setImage depois que o pulso termina (timer se desliga sozinho)", async () => {
    const { action } = fakeAction();
    iconAnimator.pulse("k2", action, (strength) => `s=${strength}`);
    await vi.advanceTimersByTimeAsync(1100 + 150);
    const callsAfterFinish = action.setImage.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(action.setImage.mock.calls.length).toBe(callsAfterFinish);
  });
});

describe("iconAnimator — breathe (efeito contínuo até stop())", () => {
  it("continua chamando setImage indefinidamente até stop()", async () => {
    const { action } = fakeAction();
    iconAnimator.breathe("k3", action, (strength) => `breathe=${strength.toFixed(2)}`);
    await vi.advanceTimersByTimeAsync(3000);
    const callsBeforeStop = action.setImage.mock.calls.length;
    expect(callsBeforeStop).toBeGreaterThan(5);

    iconAnimator.stop("k3");
    await vi.advanceTimersByTimeAsync(3000);
    expect(action.setImage.mock.calls.length).toBe(callsBeforeStop);
  });

  it("preserva a fase ao chamar breathe() de novo pra mesma tecla (não reinicia do zero)", async () => {
    const { action } = fakeAction();
    iconAnimator.breathe("k4", action, (strength) => `${strength}`);
    await vi.advanceTimersByTimeAsync(600);
    const strengthsBefore = action.setImage.mock.calls.map((c) => decodeDataUri(c[0] as string));

    iconAnimator.breathe("k4", action, (strength) => `${strength}`);
    await vi.advanceTimersByTimeAsync(90);
    const nextStrength = Number(decodeDataUri(action.setImage.mock.calls.at(-1)?.[0] as string));
    const lastBefore = Number(strengthsBefore.at(-1));
    // se tivesse reiniciado a fase, o próximo valor voltaria pro mínimo da respiração — em vez
    // disso deve continuar suavemente próximo de onde parou.
    expect(Math.abs(nextStrength - lastBefore)).toBeLessThan(0.15);
  });
});

describe("iconAnimator — sempre empacota como data URI base64", () => {
  it("nunca manda o SVG cru pro setImage — sempre data:image/svg+xml;base64,...", () => {
    const { action } = fakeAction();
    iconAnimator.pulse("k6", action, () => "<svg>conteúdo</svg>");
    const sent = action.setImage.mock.calls[0]?.[0] as string;
    expect(sent).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(decodeDataUri(sent)).toBe("<svg>conteúdo</svg>");
  });
});

describe("iconAnimator — setImage rejeitado nunca passa despercebido", () => {
  it("loga o erro via streamDeck.logger.error em vez de sumir em silêncio", async () => {
    const action = { setImage: vi.fn(async () => Promise.reject(new Error("SVG rejeitado"))) };
    iconAnimator.pulse("k5", action, () => "svg");
    await vi.advanceTimersByTimeAsync(0); // deixa o .catch() do primeiro frame (síncrono) resolver
    expect(logger.error).toHaveBeenCalledWith("Falha ao desenhar ícone dinâmico", expect.any(Error));
  });
});
