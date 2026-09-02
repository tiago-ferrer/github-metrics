import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import { fetchOrgScopedReviewRequested, type MetricsSnapshot } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

@action({ UUID: "dev.tferrer.githubmetrics.review-requested" })
export class ReviewRequestedAction extends SimpleMetricAction {
  protected label(): string {
    return "Review";
  }

  protected glyphId(): GlyphId {
    return "review-requested";
  }

  protected accent(): AccentKey {
    return "purple";
  }

  protected value(snapshot: MetricsSnapshot): number {
    return snapshot.reviewRequested;
  }

  protected url(): string {
    return "https://github.com/pulls/review-requested";
  }

  protected override fetchOrgScoped(org: string): Promise<number> {
    return fetchOrgScopedReviewRequested(org);
  }
}
