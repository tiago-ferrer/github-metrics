import { action } from "@elgato/streamdeck";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import type { MetricsSnapshot } from "../lib/metrics.js";

@action({ UUID: "com.tiagoferrer.githubmetrics.notifications" })
export class NotificationsAction extends SimpleMetricAction {
  protected label(): string {
    return "Notif.";
  }

  protected value(snapshot: MetricsSnapshot): number {
    return snapshot.notifications;
  }

  protected url(): string {
    return "https://github.com/notifications";
  }
}
