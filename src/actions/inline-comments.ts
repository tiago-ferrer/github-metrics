import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import { fetchActivityDailyBreakdown, fetchOrgActivityTotals, type MetricsSnapshot, type PeriodTotals } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

/**
 * Comentários em linhas específicas do diff de uma Pull Request (parte de uma review — diferente
 * do comentário geral na conversa, ver "PR Comments") no período selecionado — via Events API
 * (`PullRequestReviewCommentEvent`). Só cobre os últimos ~90 dias (limitação da própria API, ver
 * `metrics.ts#fetchRecentEvents`); "ano" aqui reflete só o que a API tiver disponível, não um ano
 * de verdade.
 */
@action({ UUID: "dev.tferrer.githubmetrics.inline-comments" })
export class InlineCommentsAction extends PeriodMetricAction {
  protected label(): string {
    return "Inline";
  }

  protected glyphId(): GlyphId {
    return "inline-comments";
  }

  protected accent(): AccentKey {
    return "orange";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.inlineComments;
  }

  protected async fetchOrgPeriodTotals(org: string): Promise<PeriodTotals> {
    return (await fetchOrgActivityTotals(org)).inlineComments;
  }

  protected fetchDailyBreakdown(org?: string): Promise<number[]> {
    return fetchActivityDailyBreakdown("inlineComments", org);
  }
}
