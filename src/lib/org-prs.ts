import { countSearch } from "./metrics.js";

/**
 * Conta PRs abertas escopadas a uma organização inteira (agrega todos os seus repositórios,
 * qualquer autor) ou, se `repo` for informado, a um único repositório dentro dela. Diferente
 * das actions pessoais (que sempre filtram por `--author=@me`/`--review-requested=@me`), aqui
 * a contagem é da organização como um todo, não da conta do usuário.
 */
export async function fetchOrgOpenPrCount(org: string, repo?: string): Promise<number> {
  const trimmedOrg = org.trim();
  const trimmedRepo = repo?.trim();
  const scopeArg = trimmedRepo ? `--repo=${trimmedOrg}/${trimmedRepo}` : `--owner=${trimmedOrg}`;
  return countSearch(["search", "prs", scopeArg, "--state=open"]);
}
