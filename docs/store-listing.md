# Material de listagem — Marketplace (Maker Console)

> Conteúdo pronto para colar no formulário de submissão. Itens marcados `[preencher]` dependem
> de decisão/conta do usuário e não podem ser preenchidos automaticamente.

## Nome do produto

GitHub Metrics

## Categoria

Developer Tools (ou equivalente mais próxima disponível no Maker Console)

## Descrição curta (subtítulo, ~1 frase)

Métricas gerais da sua conta GitHub — PRs, issues, notificações, commits, reviews e estrelas — direto no seu Stream Deck.

## Descrição longa

```
GitHub Metrics coloca as métricas mais importantes da sua conta GitHub a um toque de
distância — sem precisar abrir o navegador.

Diferente de outros plugins de GitHub, que monitoram um único repositório, o GitHub Metrics
mostra a visão agregada de TODA a sua conta:

• PRs abertas (de sua autoria)
• PRs aguardando sua review
• Issues atribuídas a você
• Notificações não lidas
• Commits (hoje / semana / mês / ano)
• Reviews de PR realizadas (hoje / semana / mês / ano)
• Estrelas recebidas nos seus repositórios
• Status da conta (diagnóstico de autenticação + rate limit da API)

Como funciona:
O plugin usa o GitHub CLI (gh) já instalado e autenticado na sua máquina — o mesmo `gh` que
você usa no terminal. Isso significa que nenhum token seu passa pelo plugin ou por qualquer
servidor de terceiros: a comunicação acontece direto entre o seu computador e o GitHub.

Pré-requisitos:
• GitHub CLI instalado (https://cli.github.com)
• Autenticado via `gh auth login`

Configurável:
• Usuário do GitHub (detectado automaticamente, ou pode ser sobrescrito)
• Intervalo de atualização
• Período de commits/reviews (hoje, semana, mês, ano)
```

## Preço

**US$ 5,00** (decisão do usuário — atualizado em 2026-08-17).

Split da Marketplace é 70/30 (você fica com 70%): de cada venda de US$ 5, você recebe
**≈ US$ 3,50**, pago via Stripe Connect. Detalhes: [Revenue Share](https://docs.elgato.com/monetization/revenue-share/).

⚠️ **Importante:** segundo a documentação oficial, "o nome do produto e as opções de
monetização não podem ser alterados no Maker Console" depois de submetidos — mudar de preço
(ou de pago para gratuito) depois exige contato direto com `maker@elgato.com`. Confirme o valor
antes de enviar.

⚠️ Produtos pagos exigem que o seu país seja suportado pelo Stripe Connect — confirme em
[stripe.com/global](https://stripe.com/global) antes de configurar o preço; se não for
suportado, só dá pra listar como gratuito.

## URL de suporte

`[preencher]` — ex.: link do repositório (issues do GitHub) ou e-mail de contato.

## Política de privacidade

Ver [`privacy-policy.md`](./privacy-policy.md). Publicar em uma URL pública antes da submissão
(GitHub Pages, ou como Artifact) e colar o link aqui: `[preencher]`.

## Mídia — pronta em `docs/media/`

| Arquivo | Uso no Maker Console | Especificação |
|---|---|---|
| `docs/media/thumbnail.png` | Thumbnail (obrigatório) | 1920×960 px PNG ✅ |
| `docs/media/gallery-1-overview.png` | Galeria — item 1 | 1920×960 px PNG ✅ |
| `docs/media/gallery-2-config.png` | Galeria — item 2 | 1920×960 px PNG ✅ |
| `docs/media/gallery-3-status.png` | Galeria — item 3 | 1920×960 px PNG ✅ |
| App icon (Maker Console) | `imgs/plugin/icon.png`/`icon@2x.png`, já existentes no `.sdPlugin` | reaproveitar |

**Importante sobre a origem dessas imagens:** não são capturas de tela literais do app da
Elgato (não tenho acesso ao display desta máquina para capturar a tela). São **artes de produto
originais**, montadas em HTML/CSS e renderizadas via headless Chrome, usando dados 100% reais do
plugin:
- Os 8 ícones das actions são os arquivos SVG reais do `.sdPlugin`.
- A imagem `gallery-2-config.png` embute uma **captura real** do nosso próprio arquivo
  `ui/period-metric.html` (o Property Inspector de verdade, renderizado sem dados fake — só sem
  preenchimento porque roda fora do app).
- Os números nas teclas (ex.: "3 PRs", "128 estrelas") são **exemplos ilustrativos**, não uma
  conta real — isso é normal para material de marketing, mas fique ciente disso.

Se preferir, dá pra trocar por screenshots reais do app depois — é só substituir os arquivos em
`docs/media/` mantendo os mesmos nomes/dimensões.

## Passo a passo real de submissão (3 etapas do Maker Console)

1. **Files** — sobe o `.streamDeckPlugin` (gerar com `npm run pack` se o código mudou desde o
   último build).
2. **Details** — nome, descrição (usar o texto acima, com palavras-chave pra busca), categoria,
   tags, **preço (US$ 5,00)**, links.
3. **Media & Release Notes** — thumbnail + 3 itens de galeria (seção acima) + notas da versão
   (texto abaixo, pronto pra colar — 995/1500 caracteres).

## Release Notes (v0.1.0)

```
GitHub Metrics v0.1.0 — Initial Release

See your GitHub account at a glance, right on your Stream Deck.

8 core actions:
• Open PRs (authored by you)
• PRs awaiting your review
• Issues assigned to you
• Unread notifications
• Commits (today / week / month / year)
• PR reviews completed (today / week / month / year)
• Stars received across your repositories
• Account status (gh auth + API rate limit diagnostics)

Unlike plugins tied to a single repository, GitHub Metrics gives you the aggregated view of your whole account — not one project.

How it works: uses the GitHub CLI (gh) already installed and authenticated on your machine. No token passes through the plugin or any third-party server — all communication happens directly between your computer and GitHub.

Requirements:
• GitHub CLI installed (cli.github.com)
• Authenticated via "gh auth login"

Configurable: GitHub username (auto-detected), refresh interval, and time period (today/week/month/year) for Commits and Reviews.
```

## Checklist antes de submeter

- [ ] Substituir `[preencher]` acima (URL de suporte, URL da política de privacidade).
- [x] Mídia pronta em `docs/media/` (thumbnail + 3 itens de galeria) — arte de produto original, ver nota acima sobre a origem.
- [ ] Criar organização em maker.elgato.com e assinar o Maker Agreement.
- [ ] Configurar o Stripe Connect (Monetization → Stripe) — necessário para receber pagamentos
      de produto pago; confirmar que o seu país é suportado antes de fixar o preço.
- [ ] Confirmar o preço (US$ 5,00) — **não dá pra mudar depois sem contatar `maker@elgato.com`**.
- [ ] Confirmar com o suporte da Elgato se algum passo adicional de assinatura/certificado é
      necessário para o SO Windows (ver STEPS.md, item 5.3 — documentação pública não menciona
      isso, mas vale confirmar no onboarding).
