/**
 * Pictogramas das actions, em coordenadas 0–20 (mesmo viewBox dos SVGs estáticos originais em
 * `imgs/actions/*\/icon.svg` — só reaproveitados aqui pra desenhar dentro do chip do ícone
 * dinâmico). Cada função recebe a cor de traço e devolve só o miolo (paths/circles), sem `<svg>`
 * — quem monta usa dentro de um `<g transform="...">` em `icon-render.ts`.
 */
export type GlyphId =
  | "prs-open"
  | "review-requested"
  | "issues-assigned"
  | "notifications"
  | "commits"
  | "reviews-done"
  | "stars-received"
  | "prs-project"
  | "pushes"
  | "pr-comments"
  | "inline-comments"
  | "status-ok"
  | "status-error";

const GLYPHS: Record<GlyphId, (color: string) => string> = {
  "prs-open": (c) => `
    <circle cx="5" cy="4.5" r="2.1" stroke="${c}"/>
    <line x1="5" y1="6.6" x2="5" y2="13.4" stroke="${c}"/>
    <circle cx="5" cy="15.5" r="2.1" stroke="${c}"/>
    <path d="M7.1 4.5 H13 Q15.5 4.5 15.5 7 V13.4" stroke="${c}"/>
    <circle cx="15.5" cy="15.5" r="2.1" stroke="${c}"/>`,
  "review-requested": (c) => `
    <path d="M2 10 C4.5 5.5 8 4 10 4 C12 4 15.5 5.5 18 10 C15.5 14.5 12 16 10 16 C8 16 4.5 14.5 2 10 Z" stroke="${c}"/>
    <circle cx="10" cy="10" r="2.4" fill="${c}" stroke="none"/>`,
  "issues-assigned": (c) => `
    <circle cx="10" cy="10" r="7.2" stroke="${c}"/>
    <circle cx="10" cy="10" r="2.1" fill="${c}" stroke="none"/>`,
  notifications: (c) => `
    <path d="M10 3 C7.5 3 6.3 5.2 6.3 7.8 V10.5 L4 14 H16 L13.7 10.5 V7.8 C13.7 5.2 12.5 3 10 3 Z" stroke="${c}"/>
    <path d="M8.3 15.6 a1.7 1.7 0 0 0 3.4 0" stroke="${c}"/>`,
  commits: (c) => `
    <line x1="1.5" y1="10" x2="6.3" y2="10" stroke="${c}"/>
    <circle cx="10" cy="10" r="3.5" stroke="${c}"/>
    <line x1="13.7" y1="10" x2="18.5" y2="10" stroke="${c}"/>`,
  "reviews-done": (c) => `
    <path d="M6 2.5 H12.5 L16 6 V17.5 H6 Z" stroke="${c}"/>
    <path d="M12.5 2.5 V6 H16" stroke="${c}" stroke-width="0.8"/>
    <path d="M7.8 11 L9.6 12.8 L14.2 8.2" stroke="${c}"/>`,
  "stars-received": (c) => `
    <path d="M10 2.5 L12.35 7.55 L18 8.35 L13.9 12.2 L14.9 17.5 L10 14.9 L5.1 17.5 L6.1 12.2 L2 8.35 L7.65 7.55 Z" stroke="${c}"/>`,
  "prs-project": (c) => `
    <rect x="3.5" y="3" width="9" height="14" rx="1" stroke="${c}"/>
    <path d="M12.5 8 H15.5 Q16.5 8 16.5 9 V17 H12.5" stroke="${c}"/>
    <rect x="5.7" y="5.6" width="1.8" height="1.8" fill="${c}" stroke="none"/>
    <rect x="9" y="5.6" width="1.8" height="1.8" fill="${c}" stroke="none"/>
    <rect x="5.7" y="9.2" width="1.8" height="1.8" fill="${c}" stroke="none"/>
    <rect x="9" y="9.2" width="1.8" height="1.8" fill="${c}" stroke="none"/>
    <rect x="7.3" y="13" width="3.2" height="4" fill="${c}" stroke="none"/>`,
  pushes: (c) => `
    <path d="M10 15.5 V4.5" stroke="${c}"/>
    <path d="M4.5 9 L10 3.5 L15.5 9" stroke="${c}"/>
    <path d="M3.5 17 H16.5" stroke="${c}"/>`,
  "pr-comments": (c) => `
    <path d="M3 4.5 H17 V13.5 H9 L5 17 V13.5 H3 Z" stroke="${c}"/>
    <circle cx="7" cy="9" r="0.85" fill="${c}" stroke="none"/>
    <circle cx="10" cy="9" r="0.85" fill="${c}" stroke="none"/>
    <circle cx="13" cy="9" r="0.85" fill="${c}" stroke="none"/>`,
  "inline-comments": (c) => `
    <path d="M3 4.5 H17 V13.5 H9 L5 17 V13.5 H3 Z" stroke="${c}"/>
    <path d="M6.3 7.6 H13.7" stroke="${c}" stroke-width="1.3"/>
    <path d="M6.3 10.4 H11" stroke="${c}" stroke-width="1.3"/>`,
  "status-ok": (c) => `
    <circle cx="10" cy="10" r="7.5" stroke="${c}"/>
    <path d="M6.5 10.2 L9 12.7 L13.7 7.5" stroke="${c}"/>`,
  "status-error": (c) => `
    <path d="M10 2.5 L18 17 H2 Z" stroke="${c}"/>
    <line x1="10" y1="8" x2="10" y2="12.2" stroke="${c}"/>
    <circle cx="10" cy="14.6" r="0.9" fill="${c}" stroke="none"/>`,
};

/** Desenha o pictograma (viewBox 0–20) com o traço na cor informada. */
export function glyph(id: GlyphId, color: string): string {
  return GLYPHS[id](color);
}
