import { glyph, type GlyphId } from "./glyphs.js";
import { ACCENTS, type AccentKey, escapeXml, formatCount, FONT_STACK, THEME, truncate } from "./theme.js";

/** Comprimento máximo da legenda pequena antes de truncar com "…" (cabe em 144px a 10.5–12.5px). */
const SCOPE_LABEL_MAX_LENGTH = 22;

/** Cor + intensidade (0–1) do anel de destaque ao redor do cartão — ver `icon-animator.ts`. */
export type Chrome = { color: string; strength: number };

export type MetricIconModel = {
  glyphId: GlyphId;
  accent: AccentKey;
  /** Rótulo curto abaixo do número (ex.: "PRs", "Commits"). */
  label: string;
  /** Valor a exibir; `null` quando não há nada pra mostrar (erro sem cache válido) — nesse caso usa `statusText`. */
  value: number | null;
  /** Texto curto (1–2 linhas, `\n` separa) mostrado no lugar do número quando `value` é `null`. */
  statusText?: string;
  /** Legenda pequena e discreta abaixo do rótulo (nome da org, período, "⚠ desatualizado"). */
  scopeLabel?: string;
};

function shell(content: string, chrome: Chrome | undefined): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" fill="${THEME.canvas}"/>
  <rect x="4" y="4" width="136" height="136" rx="22" fill="${THEME.card}" stroke="${THEME.border}"/>
  ${glowChrome(chrome)}
  ${content}
</svg>`;
}

function glowChrome(chrome: Chrome | undefined): string {
  if (!chrome || chrome.strength <= 0.003) return "";
  const strength = Math.max(0, Math.min(1, chrome.strength));
  const tintOpacity = (0.14 * strength).toFixed(3);
  const ringOpacity = (0.85 * strength).toFixed(3);
  const width = (1.8 + strength * 2.6).toFixed(2);
  return `
  <rect x="4" y="4" width="136" height="136" rx="22" fill="${chrome.color}" fill-opacity="${tintOpacity}"/>
  <rect x="4.6" y="4.6" width="134.8" height="134.8" rx="21.4" fill="none" stroke="${chrome.color}" stroke-opacity="${ringOpacity}" stroke-width="${width}"/>`;
}

function glyphChip(glyphId: GlyphId, color: string, cx: number, cy: number): string {
  const scale = 1.3;
  const translateX = (cx - 10 * scale).toFixed(2);
  const translateY = (cy - 10 * scale).toFixed(2);
  // Sem `vector-effect="non-scaling-stroke"` (suporte irregular no renderizador da tecla física)
  // — compensa a escala do `<g>` diminuindo o traço base, pra sair ~1.5 depois de escalado.
  const strokeWidth = (1.5 / scale).toFixed(2);
  return `
  <circle cx="${cx}" cy="${cy}" r="22" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.55" stroke-width="1.6"/>
  <g transform="translate(${translateX} ${translateY}) scale(${scale})" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    ${glyph(glyphId, color)}
  </g>`;
}

/** Tamanho de fonte do número grande — encolhe conforme o texto formatado fica mais largo. */
function numberFontSize(text: string): number {
  if (text.length <= 2) return 52;
  if (text.length <= 3) return 44;
  if (text.length <= 4) return 36;
  return 30;
}

/**
 * Texto centralizado que pode vir em 1 ou 2 linhas (`\n` separa) — usado tanto pelo texto de
 * status do número (métrica sem valor) quanto pelo rótulo da action Status da Conta. `<text>`
 * do SVG não quebra em `\n` sozinho, por isso cada linha vira seu próprio elemento.
 */
function textBlock(text: string, opts: { centerY: number; fontSize: number; lineHeight: number; weight?: number; fill?: string }): string {
  const lines = text.split("\n");
  const { centerY, fontSize, lineHeight, weight = 600, fill = THEME.text } = opts;
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  return lines
    .map(
      (line, i) =>
        `<text x="72" y="${(startY + i * lineHeight).toFixed(1)}" fill="${fill}" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="${weight}" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join("\n    ");
}

/** Ícone principal das 8 actions de métrica: chip com o pictograma, número grande, rótulo e legenda opcional. */
export function renderMetricIcon(model: MetricIconModel, chrome?: Chrome): string {
  const accentColor = ACCENTS[model.accent];
  const chip = glyphChip(model.glyphId, accentColor, 72, 40);
  const numberOrStatus =
    model.value === null
      ? textBlock(model.statusText ?? "—", { centerY: 96, fontSize: 19, lineHeight: 21 })
      : (() => {
          const text = formatCount(model.value);
          return `<text x="72" y="102" fill="${THEME.text}" font-family="${FONT_STACK}" font-size="${numberFontSize(text)}" font-weight="650" text-anchor="middle">${escapeXml(text)}</text>`;
        })();
  const label = `<text x="72" y="120" fill="${THEME.textSecondary}" font-family="${FONT_STACK}" font-size="13" font-weight="600" text-anchor="middle">${escapeXml(model.label)}</text>`;
  const scope = model.scopeLabel
    ? `<text x="72" y="133" fill="${THEME.muted}" font-family="${FONT_STACK}" font-size="10.5" text-anchor="middle">${escapeXml(truncate(model.scopeLabel, SCOPE_LABEL_MAX_LENGTH))}</text>`
    : "";
  return shell(`${chip}\n  ${numberOrStatus}\n  ${label}\n  ${scope}`, chrome);
}

export type StatusIconModel = {
  ok: boolean;
  /** Texto principal (ex.: "OK" ou o rótulo curto de erro). */
  label: string;
  /** Legenda pequena (ex.: rate limit restante). */
  scopeLabel?: string;
};

/** Ícone da action "Status da Conta" — check verde ou alerta vermelho, sem número. */
export function renderStatusIcon(model: StatusIconModel, chrome?: Chrome): string {
  const accentColor = model.ok ? ACCENTS.green : ACCENTS.red;
  const chip = glyphChip(model.ok ? "status-ok" : "status-error", accentColor, 72, 42);
  const lineCount = model.label.split("\n").length;
  const label = textBlock(model.label, {
    centerY: 98,
    fontSize: lineCount > 1 ? 20 : 27,
    lineHeight: 23,
    weight: 650,
  });
  const scope = model.scopeLabel
    ? `<text x="72" y="128" fill="${THEME.textSecondary}" font-family="${FONT_STACK}" font-size="12.5" text-anchor="middle">${escapeXml(model.scopeLabel)}</text>`
    : "";
  return shell(`${chip}\n  ${label}\n  ${scope}`, chrome);
}
