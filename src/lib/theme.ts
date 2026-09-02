/**
 * Paleta escura fixa (não detecta claro/escuro do sistema — decisão deliberada: combina com o
 * hardware do Stream Deck, que já é preto, e funciona igual em mac/Windows sem depender de
 * comandos específicos de SO). Inspirado no design system do threaddeck-for-codex, simplificado
 * pro nosso caso (contadores, não um feed de chat).
 */
/**
 * Cores sólidas (sem `rgba()`/transparência no valor) — o renderizador de SVG usado pela tecla
 * física (bem mais limitado que um navegador; a Property Inspector sim roda num Chromium
 * completo) costuma rejeitar `rgba()` em silêncio, sem erro nenhum, deixando a tecla presa na
 * imagem estática do manifest. `border`/`borderStrong` já são a cor final pré-misturada com o
 * fundo do cartão (`card`), em vez de branco translúcido.
 */
export const THEME = Object.freeze({
  canvas: "#000000",
  card: "#141414",
  raised: "#242424",
  border: "#2B2B2B",
  borderStrong: "#3D3D3D",
  text: "#F2F6FA",
  textSecondary: "#B7BEC7",
  muted: "#7A828C",
});

/** Uma cor de destaque por métrica — dá identidade visual própria a cada action (PLANO.md diz "nunca usar o logo do GitHub", cores próprias cumprem o mesmo espírito). */
export const ACCENTS = Object.freeze({
  blue: "#4C8DFF",
  purple: "#B18CFF",
  teal: "#2DD4BF",
  amber: "#F5A524",
  cyan: "#22D3EE",
  green: "#4ADE80",
  gold: "#F2C14E",
  red: "#FF6B6B",
  indigo: "#818CF8",
  pink: "#F472B6",
  orange: "#FB923C",
});

export type AccentKey = keyof typeof ACCENTS;

/**
 * Sem nomes internos (`.AppleSystemUIFont`) nem palavras-chave só de navegador (`-apple-system`)
 * — o renderizador da tecla física não é um navegador, então usa nomes de fonte concretos que
 * existem de verdade tanto no mac quanto no Windows.
 */
export const FONT_STACK = "'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif";

export function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);
}

/**
 * Corta com reticências além de `maxLength` — a legenda pequena do ícone (ex.: "owner/repo",
 * ou um apelido digitado pelo usuário) não tem quebra de linha nem largura calculada, então um
 * texto comprido demais estoura a borda do cartão (mesmo problema já corrigido no rótulo do
 * Status; aqui a entrada pode ser texto livre do usuário, então trunca defensivamente).
 */
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * Formata contagens grandes de forma compacta (1234 → "1.2k", 12345 → "12k", 1234567 → "1.2M")
 * pra caber no número grande do ícone sem precisar espremer a fonte — estrelas de repositórios
 * populares facilmente passam de milhares.
 */
export function formatCount(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return String(value);
  const format = (n: number, suffix: string): string => {
    const rounded = n < 10 ? n.toFixed(1).replace(/\.0$/, "") : String(Math.round(n));
    return `${rounded}${suffix}`;
  };
  if (abs < 1_000_000) return format(value / 1000, "k");
  return format(value / 1_000_000, "M");
}
