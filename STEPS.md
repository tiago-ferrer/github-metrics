# Steps de implementação — GitHub Metrics (Stream Deck)

> Checklist de execução. Detalhes completos (comandos `gh` exatos, campos GraphQL, JSON do manifest, regras de ícone) estão em [`PLANO.md`](./PLANO.md) — **não duplicados aqui**, apenas referenciados por seção.
>
> Regra: **1 step = 1 commit**. Ao retomar o trabalho, rode `git log --oneline` para achar o último step concluído em vez de reler este arquivo inteiro ou o PLANO.md.

**Estado atual:** Fases 0–5 completas, exceto a submissão em si (5.4, que depende de conta própria do usuário no Maker Console). `npm run build` + `npm test` (23 testes) + `streamdeck validate` + `npm run pack` (gera `.streamDeckPlugin` de verdade) passam limpos. **Testado ao vivo num Stream Deck físico real** (este ambiente tinha o app + hardware instalados) via `streamdeck dev` + `streamdeck link` — achou e corrigiu um bug crítico (ver abaixo). v1 está tecnicamente pronta para submissão — falta só o usuário publicar a política de privacidade, capturar screenshots reais e criar a conta de Maker. Depois disso, Fase 6 (v1.1) é opcional/pós-lançamento. Desvios do plano original:
- `streamdeck create` é wizard interativo sem flags não-interativas → scaffold montado manualmente na mesma estrutura oficial (confirmada via `@elgato/schemas`).
- `status` (2.9) não usa o poller central — tem seu próprio timer, pois é diagnóstico independente (não faz sentido travar junto do cache de métricas).
- Ícones das 8 actions core já existem como placeholders SVG desde a Fase 0.3 (não só na Fase 4) para o manifest/build serem válidos desde o início; Fase 4.1 foi a revisão visual real (renderizados em headless Chrome no tamanho de 20px) + troca do ícone de "status" (gauge ilegível) por um pulso.
- Fase 4.2/4.3, na hora: sem Windows neste ambiente — a 4.3 foi revisão de código focada (achou e corrigiu 1 bug real: caminho explícito do gh sem `.exe` no Windows). Cenários de erro (4.2) foram cobertos por testes automatizados (vitest) na hora, mas depois **também confirmados ao vivo** (ver abaixo).
- **Bug crítico achado e corrigido testando ao vivo** (commit `d697d0c`, depois da Fase 5): `bin/plugin.js` (CommonJS) crashava em loop no Stream Deck real porque o link de dev é um symlink pra dentro do repo, e o Node resolvia `"type": "module"` do `package.json` da raiz do repo como o mais próximo, tentando interpretar CJS como ESM. Corrigido com um `package.json` (`{"type":"commonjs"}`) dentro do próprio `.sdPlugin`. Sem esse teste ao vivo, isso teria passado despercebido por todas as fases anteriores (build/validate/pack estático não pegam esse tipo de erro de resolução de módulo em runtime).
- Também corrigido: script `watch` não reiniciava o plugin sozinho no Stream Deck (faltava `--watch.onEnd="streamdeck restart <uuid>"`, padrão oficial da Elgato) — commit `d30105b`.
- **Ainda pendente:** clicar nas actions de verdade dentro do app (arrastar pra tecla, testar Property Inspector) — isso é feito na GUI do Stream Deck, que não é acessível por aqui (ambiente sem display). O processo do plugin ficou confirmado rodando/conectado ("Plugin connected" no log do app), mas a interação visual final depende do usuário.

---

## Fase 0 — Setup

- [x] **0.1**/**0.2** `streamdeck create` é um wizard interativo (sem flags não-interativas) — scaffold feito manualmente seguindo a mesma estrutura oficial. `git init` antes, scaffold puro depois.
  commits: `chore: scaffold do plugin (...)`, `docs: plano de implementação e steps`
- [x] **0.3** Preencher `manifest.json` base: `UUID`, `OS`, `Software.MinimumVersion`, `Category` (PLANO.md §4).
  commit: `chore: configura manifest.json base`

## Fase 1 — Infra compartilhada (sem UI ainda)

- [x] **1.1** Wrapper `runGh(args: string[])` usando `execFile` (nunca `exec`) + resolução do binário via PATH com fallback de Global Settings.
  commit: `feat: wrapper de execução do gh CLI`
- [x] **1.2** Global Settings: `githubUsername` (auto via `gh api user`), `ghBinaryPath`, `refreshIntervalSeconds` (PLANO.md §4 PI global).
  commit: `feat: global settings`
- [x] **1.3** Poller central: timer configurável, cache em memória, liga/desliga em `onWillAppear`/`onWillDisappear`.
  commit: `feat: poller central com cache`
- [x] **1.4** Estados de erro reutilizáveis: gh ausente, não autenticado, rate limit, offline (PLANO.md §6).
  commit: `feat: tratamento de erros compartilhado`

## Fase 2 — Actions core v1 (uma a uma, cada uma testada isoladamente)

Referência de comando/UUID/ícone de cada uma: PLANO.md §1 tabela "v1 — Core".

- [x] **2.1** `prs-open` (PRs Abertas) — search REST simples, sem período.
  commit: `feat(action): prs-open`
- [x] **2.2** `review-requested` (Review Solicitada).
  commit: `feat(action): review-requested`
- [x] **2.3** `issues-assigned` (Issues Atribuídas).
  commit: `feat(action): issues-assigned`
- [x] **2.4** `notifications` (Notificações).
  commit: `feat(action): notifications`
- [x] **2.5** Feito adiantado dentro do commit `b8d18a4` (Fase 1.3) — a query combinada já nasceu dentro do poller central.
- [x] **2.6** `commits` (Commits) — consome cache GraphQL, período configurável.
  commit: `feat(action): commits`
- [x] **2.7** `reviews-done` (Reviews Feitas) — idem, período configurável.
  commit: `feat(action): reviews-done`
- [x] **2.8** `stars-received` (Estrelas Recebidas) — soma paginada de `stargazerCount`.
  commit: `feat(action): stars-received`
- [x] **2.9** `status` (Status da Conta) — `gh auth status` + `rate_limit`, `showOk`/`showAlert`.
  commit: `feat(action): status`

## Fase 3 — Property Inspector

- [x] **3.1** `ui/simple-metric.html` (sem config extra) — usado por prs-open, review-requested, issues-assigned, notifications, stars-received.
  commit: `feat(pi): simple-metric`
- [x] **3.2** `ui/period-metric.html` (dropdown hoje/semana/mês/ano) — commits, reviews-done.
  commit: `feat(pi): period-metric`
- [x] **3.3** `ui/status.html` (diagnóstico: auth + rate limit).
  commit: `feat(pi): status`
- [x] **3.4** PI global (username override, ghBinaryPath, refreshInterval) embutido nas telas acima.
  commit: `feat(pi): configuracoes globais`

## Fase 4 — Hardening e assets visuais

- [x] **4.1** Ícones finais: plugin (256/512), categoria (28/56), 8 actions do core (20/40) — monocromático, sem logo do GitHub (PLANO.md §5).
  commit: `chore: icones finais v1`
- [x] **4.2** Cobrir os 4 cenários de erro (§6) em todas as 8 actions + testes manuais.
  commit: `fix: cobertura de erros nas actions core`
- [x] **4.3** Teste cross-platform mac/Windows — corrigir divergências de PATH do `gh`.
  commit: `fix: compatibilidade windows/mac`

## Fase 5 — Empacotamento e submissão

- [x] **5.1** `.sdignore` + `streamdeck pack` gerando `.streamDeckPlugin` válido.
  commit: `chore: empacotamento` — testado de verdade: gera zip de 331KB, 21 arquivos, sem lixo.
- [x] **5.2** Política de privacidade + descrição/screenshots da loja.
  commit: `docs: assets de submissao` — conteúdo em `docs/privacy-policy.md` e `docs/store-listing.md`.
  **Pendente do usuário:** publicar a política de privacidade numa URL pública e capturar os
  screenshots reais (não simulados aqui — não há Stream Deck físico neste ambiente).
- [x] **5.3** Confirmar exigência de assinatura/notarização junto à Elgato — **resolvido via pesquisa** (documentado no commit `a4644aa`): a proteção/DRM é aplicada pelo Maker Console *depois* do upload, não localmente por `streamdeck pack`; não há menção pública a certificado próprio exigido do maker. Sem mudança de código necessária. Vale confirmar no onboarding do Maker Console como checagem final.
- [ ] **5.4** Submeter no Maker Console. **Requer conta própria do usuário em maker.elgato.com — não pode ser feito por aqui.** Passo a passo:
  1. Criar conta em maker.elgato.com.
  2. Preencher o formulário do produto com o conteúdo de `docs/store-listing.md`.
  3. Upload do `dev.tferrer.githubmetrics.streamDeckPlugin` (gerar de novo com `npm run pack` se o código mudou).
  4. Aguardar revisão.
  *(sem commit — processo externo; ao receber feedback da revisão, criar `CHANGELOG.md` e registrar o resultado/ajustes pedidos.)*

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
