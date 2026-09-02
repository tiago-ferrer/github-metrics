import streamDeck, {
  action,
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import { CelebrationTracker } from "../lib/celebration-tracker.js";
import { errorLabel } from "../lib/errors.js";
import { GhError } from "../lib/gh.js";
import { iconAnimator, safeSetImage } from "../lib/icon-animator.js";
import { renderMetricIcon, type MetricIconModel } from "../lib/icon-render.js";
import { fetchRepoOpenPrCount, resolveOwner } from "../lib/repo-prs.js";
import { refreshIntervalMs, type GlobalSettings, type PrsProjectSettings } from "../lib/settings.js";
import { ACCENTS } from "../lib/theme.js";

type LastGood = { count: number; owner: string; repo: string };

/**
 * PRs abertas de um repositório específico (qualquer autor — é a visão agregada do
 * repositório/equipe, não "minhas PRs"). "Repositório" é obrigatório; "Organização" é opcional
 * — se vazia, assume que o repositório é seu (mesma conta pessoal resolvida via
 * `githubUsername`/`gh api user`). Cada tecla configura seu próprio repo/org (settings por
 * instância) — por isso não usa o poller central, tem timer próprio como `status.ts`.
 * Ícone dinâmico via `setImage`: pulsa na cor da métrica quando o número muda, respira em âmbar
 * mostrando o último valor válido se a busca mais recente falhar (PLANO.md §6), ou em vermelho
 * com o rótulo do erro se não houver nenhum valor em cache ainda.
 */
@action({ UUID: "dev.tferrer.githubmetrics.org-prs-open" })
export class PrsProjectAction extends SingletonAction<PrsProjectSettings> {
  #timers = new Map<string, ReturnType<typeof setInterval>>();
  #lastGood = new Map<string, LastGood>();
  #lastModel = new Map<string, MetricIconModel>();
  #inFlight = new Set<string>();
  #celebration = new CelebrationTracker();

  override onWillAppear(ev: WillAppearEvent<PrsProjectSettings>): void {
    if (!ev.action.isKey()) return;
    const action = ev.action;
    // Idempotente: se onWillAppear disparar mais de uma vez pra mesma tecla (o app pode fazer
    // isso ao trocar de perfil/página), limpa o timer anterior antes de criar outro — sem isso,
    // cada disparo extra vazava um setInterval órfão que nunca era cancelado.
    this.#clearTimer(action.id);
    void this.#tick(action);
    void this.#startTimer(action);
  }

  override onWillDisappear(ev: WillDisappearEvent<PrsProjectSettings>): void {
    this.#clearTimer(ev.action.id);
    this.#lastGood.delete(ev.action.id);
    this.#lastModel.delete(ev.action.id);
    this.#celebration.forget(ev.action.id);
    iconAnimator.stop(ev.action.id);
  }

  #clearTimer(actionId: string): void {
    const timer = this.#timers.get(actionId);
    if (timer) clearInterval(timer);
    this.#timers.delete(actionId);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<PrsProjectSettings>): void {
    if (ev.action.isKey()) void this.#tick(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<PrsProjectSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = await ev.action.getSettings();
    await streamDeck.system.openUrl(await this.#url(settings));
    const model = this.#lastModel.get(ev.action.id);
    // Clicar confirma qualquer aumento pendente ("comemoração") — para de piscar em verde.
    this.#celebration.acknowledge(ev.action.id, model?.value ?? undefined);
    if (model) {
      iconAnimator.pulse(ev.action.id, ev.action, (strength) =>
        renderMetricIcon(model, strength > 0.01 ? { color: "#FFFFFF", strength: strength * 0.55 } : undefined),
      );
    }
  }

  async #startTimer(action: KeyAction<PrsProjectSettings>): Promise<void> {
    const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    const timer = setInterval(() => void this.#tick(action), refreshIntervalMs(globalSettings));
    this.#timers.set(action.id, timer);
  }

  /**
   * Monta a URL a partir das settings atuais da tecla — não depende de já ter uma contagem
   * bem-sucedida em cache (`#lastGood`), que ficava vazio se a primeira busca falhasse e fazia
   * o clique cair na home genérica do GitHub em vez da página de pulls do repositório.
   */
  async #url(settings: PrsProjectSettings): Promise<string> {
    const repo = settings.repo?.trim();
    if (!repo) return "https://github.com";
    const owner = await resolveOwner(settings.org);
    return `https://github.com/${owner}/${repo}/pulls`;
  }

  /** Apelido configurado pelo usuário, se houver — senão o `owner/repo` automático. */
  #scopeLabel(displayName: string | undefined, owner: string, repo: string): string {
    return displayName || `${owner}/${repo}`;
  }

  /**
   * Delega ao `CelebrationTracker`: pisca em verde continuamente enquanto o valor estiver acima
   * da última leitura confirmada pelo usuário, e só some quando ele clicar a tecla (`onKeyDown`
   * chama `acknowledge`). Devolve `true` quando já cuidou do desenho.
   */
  #handleCelebration(actionId: string, action: KeyAction<PrsProjectSettings>, model: MetricIconModel): boolean {
    if (model.value === null || !this.#celebration.observe(actionId, model.value)) return false;
    iconAnimator.breathe(actionId, action, (strength) => renderMetricIcon(model, { color: ACCENTS.green, strength }));
    return true;
  }

  /** Pulsa (valor mudou), respira (desatualizado/erro/mais PRs abertas do que da última vez visto) ou para o ícone, conforme o estado. */
  #applyIcon(actionId: string, action: KeyAction<PrsProjectSettings>, model: MetricIconModel, state: "ok" | "stale" | "error"): void {
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
    if (this.#handleCelebration(actionId, action, model)) return;
    if (previous && previous.value !== model.value) {
      iconAnimator.pulse(actionId, action, (strength) => renderMetricIcon(model, strength > 0.01 ? { color: ACCENTS.blue, strength } : undefined));
      return;
    }
    iconAnimator.stop(actionId);
    safeSetImage(action, renderMetricIcon(model));
  }

  async #tick(action: KeyAction<PrsProjectSettings>): Promise<void> {
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

  async #tickUnguarded(action: KeyAction<PrsProjectSettings>): Promise<void> {
    const settings = await action.getSettings();
    const repo = settings.repo?.trim();
    if (!repo) {
      const model: MetricIconModel = { glyphId: "prs-project", accent: "blue", label: "PRs", value: null, statusText: "Config.\nrepo" };
      this.#applyIcon(action.id, action, model, "error");
      return;
    }
    const org = settings.org?.trim();
    const displayName = settings.displayName?.trim();
    try {
      const { count, owner } = await fetchRepoOpenPrCount(repo, org);
      this.#lastGood.set(action.id, { count, owner, repo });
      const model: MetricIconModel = {
        glyphId: "prs-project",
        accent: "blue",
        label: "PRs",
        value: count,
        scopeLabel: this.#scopeLabel(displayName, owner, repo),
      };
      this.#applyIcon(action.id, action, model, "ok");
    } catch (err) {
      const cached = this.#lastGood.get(action.id);
      if (cached) {
        const model: MetricIconModel = {
          glyphId: "prs-project",
          accent: "blue",
          label: "PRs",
          value: cached.count,
          scopeLabel: `${this.#scopeLabel(displayName, cached.owner, cached.repo)} · desatualizado`,
        };
        this.#applyIcon(action.id, action, model, "stale");
      } else {
        const model: MetricIconModel = {
          glyphId: "prs-project",
          accent: "blue",
          label: "PRs",
          value: null,
          statusText: errorLabel(err),
          scopeLabel: displayName || (org ? `${org}/${repo}` : repo),
        };
        this.#applyIcon(action.id, action, model, "error");
      }
      streamDeck.logger.warn(
        `Falha ao coletar PRs de ${org ? `${org}/${repo}` : repo}: ${err instanceof GhError ? err.message : String(err)}`,
      );
    }
  }
}
