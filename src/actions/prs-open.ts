import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import { fetchOrgScopedPrsOpen, type MetricsSnapshot } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

@action({ UUID: "dev.tferrer.githubmetrics.prs-open" })
export class PrsOpenAction extends SimpleMetricAction {
  protected label(): string {
    return "PRs";
  }

  protected glyphId(): GlyphId {
    return "prs-open";
  }

  protected accent(): AccentKey {
    return "blue";
  }

  protected value(snapshot: MetricsSnapshot): number {
    return snapshot.prsOpen;
  }

  protected url(): string {
    return "https://github.com/pulls";
  }

  protected override fetchOrgScoped(org: string): Promise<number> {
    return fetchOrgScopedPrsOpen(org);
  }
}
