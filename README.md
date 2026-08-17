# GitHub Metrics — Plugin Stream Deck

Plugin para Elgato Stream Deck que exibe métricas **gerais da conta GitHub** do usuário
(PRs, issues, notificações, commits, reviews, estrelas — não de um repositório específico),
coletadas executando o `gh` (GitHub CLI) já instalado e autenticado localmente.

- Planejamento completo: [`PLANO.md`](./PLANO.md)
- Checklist de execução (1 step = 1 commit): [`STEPS.md`](./STEPS.md)

## Requisitos de desenvolvimento

- Node.js ≥ 24
- [GitHub CLI](https://cli.github.com/) instalado e autenticado (`gh auth login`)
- Stream Deck app ≥ 7.1
- `@elgato/cli` (`npm install`, já incluso em devDependencies)

## Desenvolvimento

```bash
npm install
npm run watch   # build + link + hot reload no Stream Deck
```

## Testes

```bash
npm test
```

## Empacotamento

```bash
npm run validate
npm run pack
```

Gera `dev.tferrer.githubmetrics.streamDeckPlugin`.
