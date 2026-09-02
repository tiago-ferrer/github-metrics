import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import { fetchCommitsDailyBreakdown, fetchOrgPeriodContributions, type MetricsSnapshot, type PeriodTotals } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

@action({ UUID: "dev.tferrer.githubmetrics.commits" })
export class CommitsAction extends PeriodMetricAction {
  protected label(): string {
    return "Commits";
  }

  protected glyphId(): GlyphId {
    return "commits";
  }

  protected accent(): AccentKey {
    return "cyan";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.commits;
  }

  protected async fetchOrgPeriodTotals(org: string): Promise<PeriodTotals> {
    return (await fetchOrgPeriodContributions(org)).commits;
  }

  protected fetchDailyBreakdown(org?: string): Promise<number[]> {
    return fetchCommitsDailyBreakdown(org);
  }
}
