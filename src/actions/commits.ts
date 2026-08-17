import { action } from "@elgato/streamdeck";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import type { MetricsSnapshot, PeriodTotals } from "../lib/metrics.js";

@action({ UUID: "com.tiagoferrer.githubmetrics.commits" })
export class CommitsAction extends PeriodMetricAction {
  protected label(): string {
    return "Commits";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.commits;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}` : "https://github.com";
  }
}
