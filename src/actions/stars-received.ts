import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { SimpleMetricAction } from "../lib/simple-metric-action.js";
import type { MetricsSnapshot } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

@action({ UUID: "dev.tferrer.githubmetrics.stars-received" })
export class StarsReceivedAction extends SimpleMetricAction {
  protected label(): string {
    return "Estrelas";
  }

  protected glyphId(): GlyphId {
    return "stars-received";
  }

  protected accent(): AccentKey {
    return "gold";
  }

  protected value(snapshot: MetricsSnapshot): number {
    return snapshot.starsReceived;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}?tab=repositories&sort=stargazers` : "https://github.com";
  }
}
