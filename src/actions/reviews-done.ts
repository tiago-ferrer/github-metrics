import { action } from "@elgato/streamdeck";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import type { MetricsSnapshot, PeriodTotals } from "../lib/metrics.js";

@action({ UUID: "com.tiagoferrer.githubmetrics.reviews-done" })
export class ReviewsDoneAction extends PeriodMetricAction {
  protected label(): string {
    return "Reviews";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.reviewsDone;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}` : "https://github.com";
  }
}
