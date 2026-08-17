import {
  action,
  SingletonAction,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { GhError, runGh } from "../lib/gh.js";
import { DEFAULT_REFRESH_INTERVAL_SECONDS } from "../lib/settings.js";

type AuthCheck = { ok: boolean; label: string };

async function checkStatus(): Promise<AuthCheck> {
  try {
    await runGh(["auth", "status"]);
  } catch (err) {
    const kind = err instanceof GhError ? err.kind : "unknown";
    return { ok: false, label: kind === "not-installed" ? "gh não\ninstalado" : "gh sem\nlogin" };
  }
  try {
    const remaining = await runGh(["api", "rate_limit", "--jq", ".rate.remaining"]);
    return { ok: true, label: `OK\n${remaining}` };
  } catch {
    // auth ok, mas a checagem de rate limit falhou (ex.: offline momentâneo) — ainda assim reporta OK.
    return { ok: true, label: "OK" };
  }
}

/**
 * Action de diagnóstico: valida `gh auth status` + rate limit restante. Independente do poller
 * central de métricas (PLANO.md §1, action "Status da Conta") — falha aqui explica por que as
 * outras 7 actions podem estar mostrando erro.
 */
@action({ UUID: "dev.tferrer.githubmetrics.status" })
export class StatusAction extends SingletonAction {
  #timers = new Map<string, ReturnType<typeof setInterval>>();

  override onWillAppear(ev: WillAppearEvent): void {
    if (!ev.action.isKey()) return;
    const action = ev.action;
    void this.#check(action);
    const timer = setInterval(() => void this.#check(action), DEFAULT_REFRESH_INTERVAL_SECONDS * 1000);
    this.#timers.set(action.id, timer);
  }

  override onWillDisappear(ev: WillDisappearEvent): void {
    const timer = this.#timers.get(ev.action.id);
    if (timer) clearInterval(timer);
    this.#timers.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (ev.action.isKey()) await this.#check(ev.action);
  }

  async #check(action: KeyAction): Promise<void> {
    const result = await checkStatus();
    await action.setState(result.ok ? 0 : 1);
    await action.setTitle(result.label);
    if (result.ok) await action.showOk();
    else await action.showAlert();
  }
}
