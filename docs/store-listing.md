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

## Mídia exigida (specs oficiais do Maker Console)

Já que o plugin roda de verdade nesta máquina, dá pra capturar essas imagens com o app do
Stream Deck aberto de verdade — nada aqui precisa ser simulado.

| Item | Especificação | Conteúdo sugerido |
|---|---|---|
| Thumbnail (obrigatório) | 1920×960 px, PNG | Perfil com as 8 actions do core organizadas, números reais visíveis |
| Galeria — item 1 (mín. 3 exigidos) | 1920×960 PNG **ou** 1920×1080 MP4 | Mesmo perfil, com destaque num close-up das teclas |
| Galeria — item 2 | idem | Property Inspector da action "Commits" com o dropdown de período aberto |
| Galeria — item 3 | idem | Action "Status da Conta" em OK (verde) — se der, uma segunda mostrando o estado de erro |
| App icon (Maker Console) | conforme `imgs/plugin/icon.png`/`icon@2x.png` já existentes no `.sdPlugin` | reaproveitar |

`docs/icon-preview` (gerado na Fase 4) é só teste de legibilidade dos ícones — não usar como
screenshot final de produto.

## Passo a passo real de submissão (3 etapas do Maker Console)

1. **Files** — sobe o `.streamDeckPlugin` (gerar com `npm run pack` se o código mudou desde o
   último build).
2. **Details** — nome, descrição (usar o texto acima, com palavras-chave pra busca), categoria,
   tags, **preço (US$ 5,00)**, links.
3. **Media & Release Notes** — thumbnail + 3 itens de galeria (tabela acima) + notas da versão
   (ex.: "v0.1.0 — lançamento inicial: 8 métricas core da conta GitHub via gh CLI").

## Checklist antes de submeter

- [ ] Substituir `[preencher]` acima (URL de suporte, URL da política de privacidade).
- [ ] Capturar a mídia real listada acima (thumbnail + 3 itens de galeria).
- [ ] Criar organização em maker.elgato.com e assinar o Maker Agreement.
- [ ] Configurar o Stripe Connect (Monetization → Stripe) — necessário para receber pagamentos
      de produto pago; confirmar que o seu país é suportado antes de fixar o preço.
- [ ] Confirmar o preço (US$ 5,00) — **não dá pra mudar depois sem contatar `maker@elgato.com`**.
- [ ] Confirmar com o suporte da Elgato se algum passo adicional de assinatura/certificado é
      necessário para o SO Windows (ver STEPS.md, item 5.3 — documentação pública não menciona
      isso, mas vale confirmar no onboarding).
