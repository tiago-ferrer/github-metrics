import streamDeck, {
  action,
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { reportError } from "../lib/errors.js";
import { GhError } from "../lib/gh.js";
import { fetchOrgOpenPrCount } from "../lib/org-prs.js";
import { refreshIntervalMs, type GlobalSettings, type OrgActionSettings } from "../lib/settings.js";

type LastGood = { count: number; scopeLabel: string };

/**
 * PRs abertas escopadas a uma organização (todos os repos) ou, se `repo` for informado nas
 * settings da tecla, a um único repositório dela. Cada tecla configura sua própria org/repo
 * (settings por instância, como o período de Commits/Reviews) — por isso não usa o poller
 * central (que só cobre a conta pessoal do usuário), tem timer próprio como `status.ts`.
 * Em erro, mantém o último valor válido com marca "⚠" em vez de zerar (PLANO.md §6).
 */
@action({ UUID: "dev.tferrer.githubmetrics.org-prs-open" })
export class OrgPrsOpenAction extends SingletonAction<OrgActionSettings> {
  #timers = new Map<string, ReturnType<typeof setInterval>>();
  #lastGood = new Map<string, LastGood>();
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
    await ev.action.showOk();
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
      await action.setTitle("Config.\norg");
      return;
    }
    const repo = settings.repo?.trim();
    const scopeLabel = repo || org;
    try {
      const count = await fetchOrgOpenPrCount(org, repo);
      this.#lastGood.set(action.id, { count, scopeLabel });
      await action.setTitle(`PRs\n${count}\n(${scopeLabel})`);
    } catch (err) {
      const cached = this.#lastGood.get(action.id);
      if (cached) {
        await action.setTitle(`PRs\n${cached.count} ⚠\n(${cached.scopeLabel})`);
      } else {
        await reportError(action, err);
      }
      streamDeck.logger.warn(
        `Falha ao coletar PRs de ${scopeLabel}: ${err instanceof GhError ? err.message : String(err)}`,
      );
    }
  }
}
