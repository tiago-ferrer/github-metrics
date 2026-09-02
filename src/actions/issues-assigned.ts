import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import { fetchOrgScopedIssuesAssigned, type MetricsSnapshot } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

@action({ UUID: "dev.tferrer.githubmetrics.issues-assigned" })
export class IssuesAssignedAction extends SimpleMetricAction {
  protected label(): string {
    return "Issues";
  }

  protected glyphId(): GlyphId {
    return "issues-assigned";
  }

  protected accent(): AccentKey {
    return "teal";
  }

  protected value(snapshot: MetricsSnapshot): number {
    return snapshot.issuesAssigned;
  }

  protected url(): string {
    return "https://github.com/issues/assigned";
  }

  protected override fetchOrgScoped(org: string): Promise<number> {
    return fetchOrgScopedIssuesAssigned(org);
  }
}
