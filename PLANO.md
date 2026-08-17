# Plano — Plugin Stream Deck "GitHub Metrics"

> Plugin para Elgato Stream Deck que exibe métricas **gerais da conta GitHub do usuário** (não de um repositório específico), coletadas executando o `gh` (GitHub CLI) já instalado e autenticado na máquina do usuário. Este documento consolida o planejamento completo, do conceito à submissão no Marketplace oficial da Elgato.

Última atualização: 2026-08-17

---

## 0. Conceito do produto

- **Nome sugerido:** `GitHub Metrics`
- **Proposta de valor:** diferente de plugins de GitHub existentes (que normalmente monitoram *um* repositório), este mostra a visão pessoal e agregada do usuário na plataforma inteira — PRs, issues, notificações, estrelas, commits, reviews — sem exigir configurar um repo específico.
- **Dependência chave:** o plugin **não guarda nenhum token**. Ele executa o binário `gh` já autenticado (`gh auth login`) localmente. Nenhum dado do usuário trafega por servidor do desenvolvedor — só entre a máquina do usuário e a API do GitHub, via `gh`. Isso simplifica bastante a política de privacidade exigida pelo Marketplace.
- **Ícones:** nunca usar o logo/Octocat do GitHub (marca registrada) — criar iconografia própria, monocromática.

---

## 1. Métricas — lista final consolidada

### v1 — Core (lançamento)

| # | Action (Name) | UUID (sufixo) | Ícone (pictograma) | Título exibido | Comando/campo exato | Ao clicar |
|---|---|---|---|---|---|---|
| 1 | PRs Abertas | `prs-open` | seta saindo de círculo (branch) | `PRs\n{n}` | `gh search prs --author=@me --state=open --json number --jq length` | abre `https://github.com/pulls` |
| 2 | Review Solicitada | `review-requested` | olho | `Review\n{n}` | `gh search prs --review-requested=@me --state=open --json number --jq length` | abre `https://github.com/pulls/review-requested` |
| 3 | Issues Atribuídas | `issues-assigned` | círculo com ponto | `Issues\n{n}` | `gh search issues --assignee=@me --state=open --json number --jq length` | abre `https://github.com/issues/assigned` |
| 4 | Notificações | `notifications` | sino | `Notif.\n{n}` | `gh api notifications --jq length` | abre `https://github.com/notifications` |
| 5 | Commits | `commits` | ponto em linha (git commit) | `Commits\n{n}\n({período})` | GraphQL `totalCommitContributions` — período via Property Inspector (hoje/semana/mês/ano) | abre `https://github.com/{user}?tab=overview` |
| 6 | Reviews Feitas | `reviews-done` | check sobre documento | `Reviews\n{n}\n({período})` | GraphQL `totalPullRequestReviewContributions` — período via PI | abre `https://github.com/{user}?tab=overview` |
| 7 | Estrelas Recebidas | `stars-received` | estrela contorno | `★ {n}` | GraphQL: somar `stargazerCount` de `viewer.repositories(ownerAffiliations: OWNER)` (paginado) | abre `https://github.com/{user}?tab=repositories&sort=stargazers` |
| 8 | Status da Conta | `status` | medidor/gauge | `OK` / `⚠` + rate limit restante | `gh auth status` + `gh api rate_limit --jq .rate.remaining` | `showAlert()`/`showOk()`; clique roda diagnóstico e mostra popup no PI |

### v1.1 — Extensão (release seguinte)

| # | Action | UUID (sufixo) | Ícone | Comando/campo |
|---|---|---|---|---|
| 9 | PRs Mescladas | `prs-merged` | check + branch | `gh search prs --author=@me --merged --json number --jq length` |
| 10 | Issues Fechadas | `issues-closed` | círculo com check | `gh search issues --author=@me --state=closed --json number --jq length` |
| 11 | Repos com Estrela Dada | `stars-given` | bookmark | GraphQL `viewer.starredRepositories.totalCount` |
| 12 | Seguidores | `followers` | duas pessoas | `gh api user --jq .followers` |
| 13 | Repositórios Contribuídos | `repos-contributed` | pasta | GraphQL `totalRepositoriesWithContributedCommits` |
| 14 | Issues/PRs Comentados | `commented` | balão de fala | `gh search issues "commenter:@me" --json number --jq length` |
| 15 | Organizações | `orgs` | prédio | `gh api user/orgs --jq length` |

> ⚠️ **Limitação conhecida:** a API do GitHub **não expõe um contador agregado de comentários** por usuário (nem REST, nem GraphQL). A action #14 usa o qualifier `commenter:@me`, que conta *quantas issues/PRs* o usuário comentou — não o número exato de comentários individuais. Rotular como "Issues/PRs Comentados", nunca como "Comentários", para não prometer um número que a API não sustenta.

> Todos os ícones de action: monocromáticos, traço branco `#FFFFFF`, fundo transparente, SVG — 20×20 px (+40×40 px @2x).

---

## 2. Query GraphQL combinada (poller central)

Uma única chamada GraphQL cobre commits, reviews, PRs e issues em três janelas de tempo, usando aliases — evita uma request por métrica:

```graphql
query($login: String!, $todayFrom: DateTime!, $weekFrom: DateTime!, $now: DateTime!) {
  user(login: $login) {
    hoje: contributionsCollection(from: $todayFrom, to: $now) {
      totalCommitContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      totalPullRequestContributions
    }
    semana: contributionsCollection(from: $weekFrom, to: $now) {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    ano: contributionsCollection {
      totalCommitContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      totalPullRequestContributions
      totalRepositoriesWithContributedCommits
      restrictedContributionsCount
    }
    starredRepositories { totalCount }
  }
}
```

Executado pelo backend do plugin como:

```bash
gh api graphql -f query='...' -F login="$USER" -F todayFrom="$T0" -F weekFrom="$W0" -F now="$NOW"
```

**Observação sobre `totalPullRequestContributions`:** conta PRs *abertas* (criadas) pelo usuário no período, independente do estado atual — não é o mesmo que "PRs abertas agora" (para isso, usar `gh search prs --author=@me --state=open`, action #1).

---

## 3. Arquitetura técnica

- **SDK:** `@elgato/cli` + `@elgato/streamdeck` (Node.js ≥ 24, TypeScript), gerado com `streamdeck create`.
- **Execução do `gh`:** `child_process.execFile('gh', [...args])` — nunca `exec` com concatenação de string (evita shell injection, já que parte do input, como username, pode vir do Property Inspector).
- **Resolução do binário:** procurar `gh` no `PATH`; se falhar, permitir indicar o caminho manualmente nas Global Settings (importante no Windows, onde o PATH do processo do Stream Deck pode diferir do terminal do usuário).
- **Estado compartilhado:** Global Settings (`streamDeck.settings.setGlobalSettings`) para usuário GitHub (auto-detectado via `gh api user`, com override manual), intervalo de refresh, caminho do `gh`.
- **Poller central:** roda a cada N segundos (padrão 60s, mínimo 30s), executa a query GraphQL combinada + chamadas REST necessárias (notificações, orgs/gists se essas actions estiverem ativas), guarda resultado em cache em memória; cada action só lê do cache.
- **Ciclo de vida:** polling liga/desliga via eventos `onWillAppear`/`onWillDisappear` do SDK — não gasta chamadas com botões fora da tela.
- **Cliques:** abrem a URL relevante no navegador via API do SDK / `open` cross-platform.
- **Feedback visual:** `showOk()` / `showAlert()` quando não há indicador visual próprio de sucesso/erro.

---

## 4. Estrutura do projeto

```
com.seudominio.githubmetrics.sdPlugin/
  manifest.json
  bin/plugin.js        (compilado do src/, via rollup)
  imgs/
    plugin/             (256x256 + 512x512 @2x)
    category/           (28x28 + 56x56 @2x)
    actions/
      prs-open/
      review-requested/
      issues-assigned/
      notifications/
      commits/
      reviews-done/
      stars-received/
      status/
      ... (v1.1)
  ui/
    simple-metric.html   (PI genérico, sem config extra)
    period-metric.html   (PI com dropdown de período — commits, reviews)
    status.html           (PI de diagnóstico)
```

### Manifest — campos-chave

- `UUID` em reverse-DNS, minúsculo: `com.seudominio.githubmetrics`
- `OS`: `[{ "Platform": "mac", "MinimumVersion": "13" }, { "Platform": "windows", "MinimumVersion": "10" }]`
- `Software.MinimumVersion`: versão mínima do app Stream Deck (6.4–7.4)
- Cada `Action`: `UUID` prefixado pelo UUID do plugin, `Icon`, `States[].Image`, `Controllers` (`Keypad`; `Encoder` opcional para Stream Deck+ nas actions de período), `PropertyInspectorPath`
- `CodePath`: `bin/plugin.js`
- `Category`/`CategoryIcon`: sem nome de autor/organização no título

### `manifest.json` — trecho `Actions` (core v1)

```json
{
  "Actions": [
    {
      "UUID": "com.seudominio.githubmetrics.prs-open",
      "Name": "PRs Abertas",
      "Tooltip": "Quantidade de Pull Requests abertas por você",
      "Icon": "imgs/actions/prs-open/icon",
      "PropertyInspectorPath": "ui/simple-metric.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/prs-open/key", "TitleAlignment": "middle", "FontSize": "16" }
      ]
    },
    {
      "UUID": "com.seudominio.githubmetrics.review-requested",
      "Name": "Review Solicitada",
      "Tooltip": "PRs aguardando sua review",
      "Icon": "imgs/actions/review-requested/icon",
      "PropertyInspectorPath": "ui/simple-metric.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/review-requested/key", "TitleAlignment": "middle", "FontSize": "16" }
      ]
    },
    {
      "UUID": "com.seudominio.githubmetrics.issues-assigned",
      "Name": "Issues Atribuídas",
      "Tooltip": "Issues abertas atribuídas a você",
      "Icon": "imgs/actions/issues-assigned/icon",
      "PropertyInspectorPath": "ui/simple-metric.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/issues-assigned/key", "TitleAlignment": "middle", "FontSize": "16" }
      ]
    },
    {
      "UUID": "com.seudominio.githubmetrics.notifications",
      "Name": "Notificações",
      "Tooltip": "Notificações não lidas",
      "Icon": "imgs/actions/notifications/icon",
      "PropertyInspectorPath": "ui/simple-metric.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/notifications/key", "TitleAlignment": "middle", "FontSize": "16" }
      ]
    },
    {
      "UUID": "com.seudominio.githubmetrics.commits",
      "Name": "Commits",
      "Tooltip": "Commits contribuídos no período selecionado",
      "Icon": "imgs/actions/commits/icon",
      "PropertyInspectorPath": "ui/period-metric.html",
      "Controllers": ["Keypad", "Encoder"],
      "States": [
        { "Image": "imgs/actions/commits/key", "TitleAlignment": "middle", "FontSize": "14" }
      ]
    },
    {
      "UUID": "com.seudominio.githubmetrics.reviews-done",
      "Name": "Reviews Feitas",
      "Tooltip": "Reviews de PR realizadas no período selecionado",
      "Icon": "imgs/actions/reviews-done/icon",
      "PropertyInspectorPath": "ui/period-metric.html",
      "Controllers": ["Keypad", "Encoder"],
      "States": [
        { "Image": "imgs/actions/reviews-done/key", "TitleAlignment": "middle", "FontSize": "14" }
      ]
    },
    {
      "UUID": "com.seudominio.githubmetrics.stars-received",
      "Name": "Estrelas Recebidas",
      "Tooltip": "Total de estrelas nos seus repositórios",
      "Icon": "imgs/actions/stars-received/icon",
      "PropertyInspectorPath": "ui/simple-metric.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/stars-received/key", "TitleAlignment": "middle", "FontSize": "16" }
      ]
    },
    {
      "UUID": "com.seudominio.githubmetrics.status",
      "Name": "Status da Conta",
      "Tooltip": "Diagnóstico: autenticação e rate limit da API",
      "Icon": "imgs/actions/status/icon",
      "PropertyInspectorPath": "ui/status.html",
      "Controllers": ["Keypad"],
      "States": [
        { "Image": "imgs/actions/status/key-ok", "TitleAlignment": "middle" },
        { "Image": "imgs/actions/status/key-error", "TitleAlignment": "middle" }
      ]
    }
  ]
}
```

*(Encoder controller nas actions de período aproveita o dial do Stream Deck+: girar troca hoje/semana/mês/ano, pressionar abre o link.)*

### Property Inspector — configurações

**Global (compartilhadas entre todas as actions):**
- `githubUsername` — auto-detectado via `gh api user --jq .login`, com override manual
- `ghBinaryPath` — opcional, fallback se não achar no PATH
- `refreshIntervalSeconds` — padrão 60, mínimo 30

**Por action (apenas Commits e Reviews Feitas):**
- `period` — dropdown `hoje | semana | mês | ano`

---

## 5. Design e UX (regras obrigatórias do Marketplace)

- Ícone do plugin: PNG 256×256 (+512×512 @2x)
- Ícones de action: SVG/PNG 20×20 (+40×40 @2x), monocromático, traço branco `#FFFFFF`, fundo **transparente** (nunca sólido ou colorido)
- Ícone de categoria: 28×28 (+56×56 @2x)
- 2 a 30 actions por plugin (core v1 tem 8; total com extensão, 15 — dentro do limite)
- Property Inspector salva automaticamente ao mudar (sem botão "Salvar" — proibido)
- Sem links de doação no Property Inspector
- Elementos tocáveis ≥ 35×35 px
- Nomes/categoria sem nome de autor ou organização; únicos e descritivos (≤ ~30 caracteres)

---

## 6. Tratamento de erros e segurança

Estados a cobrir explicitamente:

1. `gh` não instalado → estado de erro no botão + instrução no PI de como instalar
2. `gh` instalado mas não autenticado (`gh auth status` falha) → instrução para rodar `gh auth login`
3. Rate limit excedido → aviso visual + pausa do polling até reset
4. Sem internet / GitHub fora do ar → mantém último valor em cache + indicador de "desatualizado"
5. Nenhum token é logado ou persistido pelo plugin — autenticação 100% delegada ao `gh` local

Isso também simplifica a política de privacidade exigida pelo Marketplace: **nenhum dado do usuário trafega por servidor do desenvolvedor**.

---

## 7. Empacotamento e testes

- Dev loop: `npm run watch` (hot reload no Stream Deck)
- Testar em **macOS e Windows** (OS mínimos declarados no manifest)
- Testar cenários de erro: sem `gh`, sem auth, offline, rate limit
- Empacotar com `streamdeck pack` → gera `.streamDeckPlugin`
- **A confirmar no onboarding do Maker Console:** se assinatura de código/notarização (macOS Gatekeeper / Windows) é exigida hoje para publicação — validar diretamente com o time da Elgato antes de fechar o cronograma de build, pois pode implicar conta de desenvolvedor Apple.

---

## 8. Submissão no Marketplace (Maker Console)

1. Criar conta em **Maker Console** (maker.elgato.com) e virar "Maker"
2. Preparar assets de loja: ícone, screenshots/vídeo de galeria, descrição clara
3. Escrever **política de privacidade** (mesmo sendo "não coletamos nada", é exigida) e publicar em URL pública (ex. GitHub Pages)
4. Definir categoria e nome (sem nome de autor/organização, único, descritivo)
5. Definir preço — recomendado **gratuito**, já que roda sobre a conta/token do próprio usuário
6. Enviar via Maker Console para revisão — critérios: segurança, originalidade, qualidade, ausência de conteúdo ofensivo/infração de marca
7. Aguardar revisão (prazo não especificado publicamente — reservar tempo no cronograma para idas e voltas de correções)

---

## 9. Cronograma sugerido

| Fase | Conteúdo | Estimativa |
|---|---|---|
| 1 | Scaffold do plugin, action única ("PRs Abertas") funcionando end-to-end com `gh` | 2–3 dias |
| 2 | Poller central (GraphQL combinada) + demais 7 actions do core v1 | 3–5 dias |
| 3 | Property Inspector (config de usuário/intervalo/caminho do `gh`, dropdown de período) + tratamento de erros | 2–3 dias |
| 4 | Design final dos ícones (plugin, categoria, 8 actions) — monocromáticos, originais | 2 dias (paralelizável) |
| 5 | Testes cross-platform (mac/Windows) + casos de erro | 2 dias |
| 6 | Assets de loja, política de privacidade, empacotamento (`streamdeck pack`) | 1–2 dias |
| 7 | Submissão no Maker Console + ciclo de revisão/correções | variável (fora do controle do time) |
| 8 | v1.1: 7 actions extras (PRs mescladas, issues fechadas, starred, seguidores, repos contribuídos, comentados, orgs) | 3–4 dias |

---

## 10. Riscos / pontos em aberto a validar

- **Localização do `gh` no PATH do processo do Stream Deck**, especialmente Windows — mitigado com config manual no PI
- **Rate limit da API do GitHub** se o usuário tiver muitos repositórios (paginação na soma de estrelas)
- **Assinatura de código/notarização** — confirmar exigência atual junto à Elgato antes de fechar o cronograma de build
- **Ineditismo** — verificar no Marketplace se já existe plugin de GitHub muito parecido, reforçando na descrição o diferencial (visão agregada da conta, não por repositório)
- **Comentários** — API do GitHub não expõe contagem agregada; métrica exposta é aproximada (issues/PRs comentados, não comentários individuais)

---

## Fontes

- [Getting Started | Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/)
- [Distribution | Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/introduction/distribution/)
- [Plugin Guidelines | Marketplace](https://docs.elgato.com/guidelines/stream-deck/plugins/)
- [Manifest Reference | Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/references/manifest/)
- [Submission Guidelines | Makers](https://docs.elgato.com/en/general/submission-guidelines)
- [Become a Maker | Marketplace](https://docs.elgato.com/makers/general/become-a-maker/)
- [Review Process | Marketplace](https://docs.elgato.com/maker-console/review-process/)
