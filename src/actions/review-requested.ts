import { action } from "@elgato/streamdeck";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import { fetchOrgScopedReviewRequested, type MetricsSnapshot } from "../lib/metrics.js";

@action({ UUID: "dev.tferrer.githubmetrics.review-requested" })
export class ReviewRequestedAction extends SimpleMetricAction {
  protected label(): string {
    return "Review";
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
