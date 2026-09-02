import streamDeck, {
  action,
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { errorLabel } from "../lib/errors.js";
import { GhError } from "../lib/gh.js";
import { iconAnimator, safeSetImage } from "../lib/icon-animator.js";
import { renderMetricIcon, type MetricIconModel } from "../lib/icon-render.js";
import { fetchOrgOpenPrCount } from "../lib/org-prs.js";
import { refreshIntervalMs, type GlobalSettings, type OrgActionSettings } from "../lib/settings.js";
import { ACCENTS } from "../lib/theme.js";

/**
 * PRs abertas escopadas a uma organização (todos os repos) ou, se `repo` for informado nas
 * settings da tecla, a um único repositório dela. Cada tecla configura sua própria org/repo
 * (settings por instância, como o período de Commits/Reviews) — por isso não usa o poller
 * central (que só cobre a conta pessoal do usuário), tem timer próprio como `status.ts`.
 * Ícone dinâmico via `setImage`: pulsa na cor da métrica quando o número muda, respira em
 * âmbar mostrando o último valor válido se a busca mais recente falhar (PLANO.md §6), ou em
 * vermelho com o rótulo do erro se não houver nenhum valor em cache ainda.
 */
@action({ UUID: "dev.tferrer.githubmetrics.org-prs-open" })
export class OrgPrsOpenAction extends SingletonAction<OrgActionSettings> {
  #timers = new Map<string, ReturnType<typeof setInterval>>();
  #lastGood = new Map<string, number>();
  #lastModel = new Map<string, MetricIconModel>();
  #inFlight = new Set<string>();

  override onWillAppear(ev: WillAppearEvent<OrgActionSettings>): void {
    if (!ev.action.isKey()) return;
    const action = ev.action;
    // Idempotente: se onWillAppear disparar mais de uma vez pra mesma tecla (o app pode fazer
    // isso ao trocar de perfil/página), limpa o timer anterior antes de criar outro — sem isso,
    // cada disparo extra vazava um setInterval órfão que nunca era cancelado.
    this.#clearTimer(action.id);
    void this.#tick(action);
    void this.#startTimer(action);
  }

  override onWillDisappear(ev: WillDisappearEvent<OrgActionSettings>): void {
    this.#clearTimer(ev.action.id);
    this.#lastGood.delete(ev.action.id);
    this.#lastModel.delete(ev.action.id);
    iconAnimator.stop(ev.action.id);
  }

  #clearTimer(actionId: string): void {
    const timer = this.#timers.get(actionId);
    if (timer) clearInterval(timer);
    this.#timers.delete(actionId);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<OrgActionSettings>): void {
    if (ev.action.isKey()) void this.#tick(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<OrgActionSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = await ev.action.getSettings();
    await streamDeck.system.openUrl(this.#url(settings));
    const model = this.#lastModel.get(ev.action.id);
    if (model) {
      iconAnimator.pulse(ev.action.id, ev.action, (strength) =>
        renderMetricIcon(model, strength > 0.01 ? { color: "#FFFFFF", strength: strength * 0.55 } : undefined),
      );
    }
  }

  async #startTimer(action: KeyAction<OrgActionSettings>): Promise<void> {
    const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const timer = setInterval(() => void this.#tick(action), refreshIntervalMs(globalSettings));
    this.#timers.set(action.id, timer);
  }

  #url(settings: OrgActionSettings): string {
    const org = settings.org?.trim();
    const repo = settings.repo?.trim();
    if (!org) return "https://github.com";
    if (repo) return `https://github.com/${org}/${repo}/pulls`;
    return `https://github.com/search?q=${encodeURIComponent(`is:pr is:open org:${org}`)}&type=pullrequests`;
  }

  /** Pulsa (valor mudou), respira (desatualizado/erro) ou para o ícone, conforme o estado. */
  #applyIcon(actionId: string, action: KeyAction<OrgActionSettings>, model: MetricIconModel, state: "ok" | "stale" | "error"): void {
    const previous = this.#lastModel.get(actionId);
    this.#lastModel.set(actionId, model);

    if (state === "error") {
      iconAnimator.breathe(actionId, action, (strength) => renderMetricIcon(model, { color: ACCENTS.red, strength }));
      return;
    }
    if (state === "stale") {
      iconAnimator.breathe(actionId, action, (strength) => renderMetricIcon(model, { color: ACCENTS.amber, strength }));
      return;
    }
    if (previous && previous.value !== model.value) {
      iconAnimator.pulse(actionId, action, (strength) => renderMetricIcon(model, strength > 0.01 ? { color: ACCENTS.blue, strength } : undefined));
      return;
    }
    iconAnimator.stop(actionId);
    safeSetImage(action, renderMetricIcon(model));
  }

  async #tick(action: KeyAction<OrgActionSettings>): Promise<void> {
    // Trava por tecla: se o timer, onDidReceiveSettings e a chamada inicial em onWillAppear
    // colidirem (ou qualquer evento disparar de novo antes da busca anterior terminar), ignora
    // a chamada nova em vez de empilhar execFile concorrentes pra mesma tecla.
    if (this.#inFlight.has(action.id)) return;
    this.#inFlight.add(action.id);
    try {
      await this.#tickUnguarded(action);
    } finally {
      this.#inFlight.delete(action.id);
    }
  }

  async #tickUnguarded(action: KeyAction<OrgActionSettings>): Promise<void> {
    const settings = await action.getSettings();
    const org = settings.org?.trim();
    if (!org) {
      const model: MetricIconModel = { glyphId: "org-prs-open", accent: "blue", label: "PRs", value: null, statusText: "Config.\norg" };
      this.#applyIcon(action.id, action, model, "error");
      return;
    }
    const repo = settings.repo?.trim();
    const scopeLabel = repo || org;
    try {
      const count = await fetchOrgOpenPrCount(org, repo);
      this.#lastGood.set(action.id, count);
      const model: MetricIconModel = { glyphId: "org-prs-open", accent: "blue", label: "PRs", value: count, scopeLabel };
      this.#applyIcon(action.id, action, model, "ok");
    } catch (err) {
      const cached = this.#lastGood.get(action.id);
      if (cached !== undefined) {
        const model: MetricIconModel = { glyphId: "org-prs-open", accent: "blue", label: "PRs", value: cached, scopeLabel: `${scopeLabel} · desatualizado` };
        this.#applyIcon(action.id, action, model, "stale");
      } else {
        const model: MetricIconModel = { glyphId: "org-prs-open", accent: "blue", label: "PRs", value: null, statusText: errorLabel(err) };
        this.#applyIcon(action.id, action, model, "error");
      }
      streamDeck.logger.warn(
        `Falha ao coletar PRs de ${scopeLabel}: ${err instanceof GhError ? err.message : String(err)}`,
      );
    }
  }
}
