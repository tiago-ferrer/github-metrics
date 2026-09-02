import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import { fetchOrgScopedNotifications, type MetricsSnapshot } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

@action({ UUID: "dev.tferrer.githubmetrics.notifications" })
export class NotificationsAction extends SimpleMetricAction {
  protected label(): string {
    return "Notif.";
  }

  protected glyphId(): GlyphId {
    return "notifications";
  }

  protected accent(): AccentKey {
    return "amber";
  }

  protected value(snapshot: MetricsSnapshot): number {
    return snapshot.notifications;
  }

  protected url(): string {
    return "https://github.com/notifications";
  }

  protected override fetchOrgScoped(org: string): Promise<number> {
    return fetchOrgScopedNotifications(org);
  }
}
