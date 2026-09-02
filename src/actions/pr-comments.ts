import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import { fetchOrgActivityTotals, type MetricsSnapshot, type PeriodTotals } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

/**
 * Comentários feitos na conversa de Pull Requests (não em issues comuns, nem comentário em linha
 * do diff — ver "Inline Comments") no período selecionado — via Events API (`IssueCommentEvent`
 * com `payload.issue.pull_request` presente). Só cobre os últimos ~90 dias (limitação da própria
 * API, ver `metrics.ts#fetchRecentEvents`); "ano" aqui reflete só o que a API tiver disponível,
 * não um ano de verdade.
 */
@action({ UUID: "dev.tferrer.githubmetrics.pr-comments" })
export class PrCommentsAction extends PeriodMetricAction {
  protected label(): string {
    return "PR Coment.";
  }

  protected glyphId(): GlyphId {
    return "pr-comments";
  }

  protected accent(): AccentKey {
    return "pink";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.prComments;
  }

  protected async fetchOrgPeriodTotals(org: string): Promise<PeriodTotals> {
    return (await fetchOrgActivityTotals(org)).prComments;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}` : "https://github.com";
  }
}
