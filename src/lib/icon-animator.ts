/**
 * Motor de animação genérico dos ícones dinâmicos. Duas espécies de efeito:
 *
 * - `pulse`: dispara uma vez (o valor mudou, ou o usuário pressionou a tecla) e decai
 *   suavemente por ~1.1s até desaparecer — depois disso o registro é removido sozinho.
 * - `breathe`: "respira" continuamente (dado desatualizado/erro) até `stop()` ser chamado
 *   pelo chamador quando o estado deixa de ser esse.
 *
 * Só existe UM timer global, e ele só roda enquanto há pelo menos 1 tecla animando — sem
 * nenhum efeito ativo, nada consome CPU (mesmo espírito do poller central em `poller.ts`).
 * Inspirado no `motion.js` do threaddeck-for-codex, simplificado pro nosso caso.
 */

import streamDeck from "@elgato/streamdeck";

const FRAME_INTERVAL_MS = 90; // ~11fps: suave a olho nu, leve o bastante pro CPU
const PULSE_DURATION_MS = 1100;
const BREATHE_PERIOD_MS = 2400;
const BREATHE_MIN_STRENGTH = 0.32;

type EffectKind = "pulse" | "breathe";

type SettableAction = { setImage(image?: string): Promise<void> };

/**
 * O SDK aceita SVG cru em `setImage`, mas na prática o caminho testado e usado por plugins reais
 * em produção (ex.: threaddeck-for-codex) é sempre empacotar como data URI base64 — o app aceita
 * os dois formalmente, mas só o segundo se mostrou consistentemente confiável na tecla física.
 */
function toDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
}

/**
 * `action.setImage(svg)` sem tratamento de erro falha em silêncio — se a imagem for rejeitada
 * pelo renderizador da tecla, ela simplesmente fica presa na anterior, sem nada no log
 * explicando o motivo. Todo `setImage` do ícone dinâmico passa por aqui pra isso nunca mais
 * passar despercebido.
 */
export function safeSetImage(action: SettableAction, svg: string): void {
  action.setImage(toDataUri(svg)).catch((err) => {
    streamDeck.logger.error("Falha ao desenhar ícone dinâmico", err);
  });
}

type Registration = {
  action: SettableAction;
  kind: EffectKind;
  startedAtMs: number;
  render: (strength: number) => string;
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Easing suave (smootherstep) — mesma curva usada no threaddeck-for-codex. */
function smootherStep01(x: number): number {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

class IconAnimator {
  #registrations = new Map<string, Registration>();
  #timer: ReturnType<typeof setInterval> | null = null;

  /** Pulso único: reinicia mesmo se já houver um rodando pra essa tecla (ex.: valor mudou de novo antes do pulso anterior acabar). */
  pulse(actionId: string, action: SettableAction, render: (strength: number) => string): void {
    this.#registrations.set(actionId, { action, kind: "pulse", startedAtMs: Date.now(), render });
    this.#renderOne(actionId);
    this.#ensureRunning();
  }

  /** "Respiração" contínua — preserva o instante de início se já estava respirando (não reseta a fase a cada re-render). */
  breathe(actionId: string, action: SettableAction, render: (strength: number) => string): void {
    const previous = this.#registrations.get(actionId);
    const startedAtMs = previous?.kind === "breathe" ? previous.startedAtMs : Date.now();
    this.#registrations.set(actionId, { action, kind: "breathe", startedAtMs, render });
    this.#renderOne(actionId);
    this.#ensureRunning();
  }

  /** Encerra qualquer efeito ativo pra essa tecla (estado "settled" — quem chama já desenhou a versão final). */
  stop(actionId: string): void {
    this.#registrations.delete(actionId);
    if (this.#registrations.size === 0) this.#stopTimer();
  }

  #ensureRunning(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => this.#tick(), FRAME_INTERVAL_MS);
  }

  #stopTimer(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  #strengthAt(reg: Registration, nowMs: number): { strength: number; finished: boolean } {
    if (reg.kind === "pulse") {
      const progress = smootherStep01((nowMs - reg.startedAtMs) / PULSE_DURATION_MS);
      return { strength: 1 - progress, finished: progress >= 1 };
    }
    const phase = ((nowMs - reg.startedAtMs) % BREATHE_PERIOD_MS) / BREATHE_PERIOD_MS;
    const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    return { strength: BREATHE_MIN_STRENGTH + (1 - BREATHE_MIN_STRENGTH) * wave, finished: false };
  }

  #renderOne(actionId: string): void {
    const reg = this.#registrations.get(actionId);
    if (!reg) return;
    const { strength, finished } = this.#strengthAt(reg, Date.now());
    safeSetImage(reg.action, reg.render(strength));
    if (finished) this.#registrations.delete(actionId);
  }

  #tick(): void {
    for (const actionId of [...this.#registrations.keys()]) this.#renderOne(actionId);
    if (this.#registrations.size === 0) this.#stopTimer();
  }
}

export const iconAnimator = new IconAnimator();
