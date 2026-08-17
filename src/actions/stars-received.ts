import { action } from "@elgato/streamdeck";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import type { MetricsSnapshot } from "../lib/metrics.js";

@action({ UUID: "com.tiagoferrer.githubmetrics.stars-received" })
export class StarsReceivedAction extends SimpleMetricAction {
  protected label(): string {
    return "★";
  }

  protected value(snapshot: MetricsSnapshot): number {
    return snapshot.starsReceived;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}?tab=repositories&sort=stargazers` : "https://github.com";
  }
}
