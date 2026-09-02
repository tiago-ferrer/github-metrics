import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import type { MetricsSnapshot, OrgPeriodContributions, PeriodTotals } from "../lib/metrics.js";
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

  protected orgTotals(contributions: OrgPeriodContributions): PeriodTotals {
    return contributions.reviewsDone;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}` : "https://github.com";
  }
}
