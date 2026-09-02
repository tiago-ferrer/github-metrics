import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import { fetchOrgPeriodContributions, fetchReviewsDoneDailyBreakdown, type MetricsSnapshot, type PeriodTotals } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

@action({ UUID: "dev.tferrer.githubmetrics.reviews-done" })
export class ReviewsDoneAction extends PeriodMetricAction {
  protected label(): string {
    return "Reviews";
  }

  protected glyphId(): GlyphId {
    return "reviews-done";
  }

  protected accent(): AccentKey {
    return "green";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.reviewsDone;
  }

  protected async fetchOrgPeriodTotals(org: string): Promise<PeriodTotals> {
    return (await fetchOrgPeriodContributions(org)).reviewsDone;
  }

  protected fetchDailyBreakdown(org?: string): Promise<number[]> {
    return fetchReviewsDoneDailyBreakdown(org);
  }
}
