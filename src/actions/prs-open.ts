import { action } from "@elgato/streamdeck";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import { fetchOrgScopedPrsOpen, type MetricsSnapshot } from "../lib/metrics.js";

@action({ UUID: "dev.tferrer.githubmetrics.prs-open" })
export class PrsOpenAction extends SimpleMetricAction {
  protected label(): string {
    return "PRs";
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
