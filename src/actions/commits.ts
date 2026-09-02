import { action } from "@elgato/streamdeck";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import type { MetricsSnapshot, OrgPeriodContributions, PeriodTotals } from "../lib/metrics.js";

@action({ UUID: "dev.tferrer.githubmetrics.commits" })
export class CommitsAction extends PeriodMetricAction {
  protected label(): string {
    return "Commits";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.commits;
  }

  protected orgTotals(contributions: OrgPeriodContributions): PeriodTotals {
    return contributions.commits;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}` : "https://github.com";
  }
}
