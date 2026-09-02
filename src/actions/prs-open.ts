import { action } from "@elgato/streamdeck";
import type { GlyphId } from "../lib/glyphs.js";
import { PeriodMetricAction } from "../lib/period-metric-action.js";
import { fetchOrgPrsOpenByPeriod, fetchPrsOpenDailyBreakdown, type MetricsSnapshot, type PeriodTotals } from "../lib/metrics.js";
import type { AccentKey } from "../lib/theme.js";

/**
 * PRs abertas por mim (`@me`) criadas no período selecionado (hoje/semana/mês/ano) e que ainda
 * seguem abertas agora — não é "todas as PRs abertas agora", é "quantas das que eu abri nesse
 * período continuam em aberto".
 */
@action({ UUID: "dev.tferrer.githubmetrics.prs-open" })
export class PrsOpenAction extends PeriodMetricAction {
  protected label(): string {
    return "PRs";
  }

  protected glyphId(): GlyphId {
    return "prs-open";
  }

  protected accent(): AccentKey {
    return "blue";
  }

  protected totals(snapshot: MetricsSnapshot): PeriodTotals {
    return snapshot.prsOpen;
  }

  protected fetchOrgPeriodTotals(org: string): Promise<PeriodTotals> {
    return fetchOrgPrsOpenByPeriod(org);
  }

  protected fetchDailyBreakdown(org?: string): Promise<number[]> {
    return fetchPrsOpenDailyBreakdown(org);
  }

  protected override celebrateIncrease(): boolean {
    return true;
  }
}
