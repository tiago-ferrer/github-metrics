# Steps de implementação — GitHub Metrics (Stream Deck)

> Checklist de execução. Detalhes completos (comandos `gh` exatos, campos GraphQL, JSON do manifest, regras de ícone) estão em [`PLANO.md`](./PLANO.md) — **não duplicados aqui**, apenas referenciados por seção.
>
> Regra: **1 step = 1 commit**. Ao retomar o trabalho, rode `git log --oneline` para achar o último step concluído em vez de reler este arquivo inteiro ou o PLANO.md.

---

## Fase 0 — Setup

- [ ] **0.1** `streamdeck create` (Node ≥24, TS) → estrutura base do plugin.
  commit: `chore: scaffold do plugin via streamdeck create`
- [ ] **0.2** `git init`, `.gitignore` (node_modules, bin/, *.streamDeckPlugin), commit inicial do scaffold puro.
  commit: `chore: init repo`
- [ ] **0.3** Preencher `manifest.json` base: `UUID`, `OS`, `Software.MinimumVersion`, `Category` (PLANO.md §4).
  commit: `chore: configura manifest.json base`

## Fase 1 — Infra compartilhada (sem UI ainda)

- [ ] **1.1** Wrapper `runGh(args: string[])` usando `execFile` (nunca `exec`) + resolução do binário via PATH com fallback de Global Settings.
  commit: `feat: wrapper de execução do gh CLI`
- [ ] **1.2** Global Settings: `githubUsername` (auto via `gh api user`), `ghBinaryPath`, `refreshIntervalSeconds` (PLANO.md §4 PI global).
  commit: `feat: global settings`
- [ ] **1.3** Poller central: timer configurável, cache em memória, liga/desliga em `onWillAppear`/`onWillDisappear`.
  commit: `feat: poller central com cache`
- [ ] **1.4** Estados de erro reutilizáveis: gh ausente, não autenticado, rate limit, offline (PLANO.md §6).
  commit: `feat: tratamento de erros compartilhado`

## Fase 2 — Actions core v1 (uma a uma, cada uma testada isoladamente)

Referência de comando/UUID/ícone de cada uma: PLANO.md §1 tabela "v1 — Core".

- [ ] **2.1** `prs-open` (PRs Abertas) — search REST simples, sem período.
  commit: `feat(action): prs-open`
- [ ] **2.2** `review-requested` (Review Solicitada).
  commit: `feat(action): review-requested`
- [ ] **2.3** `issues-assigned` (Issues Atribuídas).
  commit: `feat(action): issues-assigned`
- [ ] **2.4** `notifications` (Notificações).
  commit: `feat(action): notifications`
- [ ] **2.5** Query GraphQL combinada no poller (PLANO.md §2) — commits/reviews/PRs/issues em 3 janelas + starred count.
  commit: `feat: query graphql combinada no poller`
- [ ] **2.6** `commits` (Commits) — consome cache GraphQL, período configurável.
  commit: `feat(action): commits`
- [ ] **2.7** `reviews-done` (Reviews Feitas) — idem, período configurável.
  commit: `feat(action): reviews-done`
- [ ] **2.8** `stars-received` (Estrelas Recebidas) — soma paginada de `stargazerCount`.
  commit: `feat(action): stars-received`
- [ ] **2.9** `status` (Status da Conta) — `gh auth status` + `rate_limit`, `showOk`/`showAlert`.
  commit: `feat(action): status`

## Fase 3 — Property Inspector

- [ ] **3.1** `ui/simple-metric.html` (sem config extra) — usado por prs-open, review-requested, issues-assigned, notifications, stars-received.
  commit: `feat(pi): simple-metric`
- [ ] **3.2** `ui/period-metric.html` (dropdown hoje/semana/mês/ano) — commits, reviews-done.
  commit: `feat(pi): period-metric`
- [ ] **3.3** `ui/status.html` (diagnóstico: auth + rate limit).
  commit: `feat(pi): status`
- [ ] **3.4** PI global (username override, ghBinaryPath, refreshInterval) embutido nas telas acima.
  commit: `feat(pi): configuracoes globais`

## Fase 4 — Hardening e assets visuais

- [ ] **4.1** Ícones finais: plugin (256/512), categoria (28/56), 8 actions do core (20/40) — monocromático, sem logo do GitHub (PLANO.md §5).
  commit: `chore: icones finais v1`
- [ ] **4.2** Cobrir os 4 cenários de erro (§6) em todas as 8 actions + testes manuais.
  commit: `fix: cobertura de erros nas actions core`
- [ ] **4.3** Teste cross-platform mac/Windows — corrigir divergências de PATH do `gh`.
  commit: `fix: compatibilidade windows/mac`

## Fase 5 — Empacotamento e submissão

- [ ] **5.1** `.sdignore` + `streamdeck pack` gerando `.streamDeckPlugin` válido.
  commit: `chore: empacotamento`
- [ ] **5.2** Política de privacidade (página pública) + descrição/screenshots da loja.
  commit: `docs: assets de submissao`
- [ ] **5.3** Confirmar exigência de assinatura/notarização junto à Elgato (PLANO.md §7) — ajustar build se necessário.
  commit: `chore: assinatura de codigo` (se aplicável)
- [ ] **5.4** Submeter no Maker Console. *(sem commit — processo externo; anotar feedback da revisão em `CHANGELOG.md` quando chegar)*

## Fase 6 — v1.1 (pós-lançamento)

Referência: PLANO.md §1 tabela "v1.1 — Extensão". Uma action por commit, mesmo padrão da Fase 2:

- [ ] **6.1** `prs-merged`
- [ ] **6.2** `issues-closed`
- [ ] **6.3** `stars-given`
- [ ] **6.4** `followers`
- [ ] **6.5** `repos-contributed`
- [ ] **6.6** `commented`
- [ ] **6.7** `orgs`

commit por item: `feat(action): <uuid-sufixo>`
