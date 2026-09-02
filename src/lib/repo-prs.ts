import streamDeck from "@elgato/streamdeck";
import { countSearch, resolveUsername } from "./metrics.js";
import type { GlobalSettings } from "./settings.js";

/** Resolve o "dono" do repositório: a organização informada, ou (se vazia) a própria conta do usuário. */
export async function resolveOwner(org?: string): Promise<string> {
  const trimmedOrg = org?.trim();
  if (trimmedOrg) return trimmedOrg;
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  return resolveUsername(settings);
}

export type RepoPrCount = { count: number; owner: string };

/**
 * Conta PRs abertas de um repositório específico (qualquer autor, não só `@me` — é a visão
 * agregada do repositório/equipe). `org` é opcional: se vazio, assume que o repositório é seu
 * (mesma conta pessoal resolvida via `githubUsername`/`gh api user`).
 */
export async function fetchRepoOpenPrCount(repo: string, org?: string): Promise<RepoPrCount> {
  const owner = await resolveOwner(org);
  const count = await countSearch(["search", "prs", `--repo=${owner}/${repo.trim()}`, "--state=open"]);
  return { count, owner };
}
