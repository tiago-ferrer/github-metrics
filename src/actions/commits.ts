import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import type { MetricsSnapshot, OrgPeriodContributions, PeriodTotals } from "../lib/metrics.js";
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

  protected orgTotals(contributions: OrgPeriodContributions): PeriodTotals {
    return contributions.commits;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}` : "https://github.com";
  }
}
