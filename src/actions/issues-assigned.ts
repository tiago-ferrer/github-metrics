import { action } from "@elgato/streamdeck";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import { fetchOrgScopedIssuesAssigned, type MetricsSnapshot } from "../lib/metrics.js";

@action({ UUID: "dev.tferrer.githubmetrics.issues-assigned" })
export class IssuesAssignedAction extends SimpleMetricAction {
  protected label(): string {
    return "Issues";
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
