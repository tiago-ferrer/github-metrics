/**
 * Rastreia quando um valor sobe acima da última leitura confirmada pelo usuário (ex.: mais PRs
 * abertas do que da última vez que ele olhou) e quando parar de sinalizar isso — usado por
 * `PeriodMetricAction` (PRs Abertas) e `PrsProjectAction` pra "piscar em verde continuamente até
 * o usuário clicar a tecla", diferente do pulso normal (que decai sozinho em ~1.1s independente
 * de interação).
 */
export class CelebrationTracker {
  #baseline = new Map<string, number>();
  #celebrating = new Set<string>();

  /**
   * Chamado a cada leitura nova. Devolve `true` enquanto o valor estiver acima da última base
   * confirmada — continua `true` mesmo que o valor oscile depois (contanto que não volte abaixo
   * da base original), até `acknowledge()` ser chamado.
   */
  observe(actionId: string, value: number): boolean {
    const baseline = this.#baseline.get(actionId);
    if (baseline === undefined) {
      this.#baseline.set(actionId, value); // primeira leitura — sem base pra comparar, só registra
      return false;
    }
    if (this.#celebrating.has(actionId) || value > baseline) {
      this.#celebrating.add(actionId);
      return true;
    }
    this.#baseline.set(actionId, value); // não subiu — acompanha o valor atual como nova base
    return false;
  }

  /** Confirma o aumento pendente (se houver) — chamado quando o usuário clica a tecla. */
  acknowledge(actionId: string, currentValue: number | undefined): void {
    if (currentValue !== undefined) this.#baseline.set(actionId, currentValue);
    this.#celebrating.delete(actionId);
  }

  /** Limpa o estado desta tecla (ex.: onWillDisappear, ou troca de escopo — valor anterior não é comparável). */
  forget(actionId: string): void {
    this.#baseline.delete(actionId);
    this.#celebrating.delete(actionId);
  }
}
