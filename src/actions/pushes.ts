import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import { fetchOrgActivityTotals, type MetricsSnapshot, type PeriodTotals } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

/**
 * Pushes feitos no período selecionado — via Events API (`PushEvent`), já que
 * `contributionsCollection` não expõe push como tipo de contribuição. Só cobre os últimos ~90
 * dias (limitação da própria API, ver `metrics.ts#fetchRecentEvents`); "ano" aqui reflete só o
 * que a API tiver disponível, não um ano de verdade.
 */
@action({ UUID: "dev.tferrer.githubmetrics.pushes" })
export class PushesAction extends PeriodMetricAction {
  protected label(): string {
    return "Pushes";
  }

  protected glyphId(): GlyphId {
    return "pushes";
  }

  protected accent(): AccentKey {
    return "indigo";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.pushes;
  }

  protected async fetchOrgPeriodTotals(org: string): Promise<PeriodTotals> {
    return (await fetchOrgActivityTotals(org)).pushes;
  }

  protected url(snapshot: MetricsSnapshot | null): string {
    return snapshot ? `https://github.com/${snapshot.username}` : "https://github.com";
  }
}
