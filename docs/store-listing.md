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

Gratuito — o plugin roda inteiramente sobre a conta/autenticação do próprio usuário; não há
custo de infraestrutura do lado do desenvolvedor a recuperar.

## URL de suporte

`[preencher]` — ex.: link do repositório (issues do GitHub) ou e-mail de contato.

## Política de privacidade

Ver [`privacy-policy.md`](./privacy-policy.md). Publicar em uma URL pública antes da submissão
(GitHub Pages, ou como Artifact) e colar o link aqui: `[preencher]`.

## Screenshots / itens de galeria (a capturar manualmente, com o plugin rodando de verdade)

Não há Stream Deck físico neste ambiente de desenvolvimento — as imagens abaixo precisam ser
capturadas manualmente pelo usuário antes da submissão. Roteiro sugerido:

1. **Visão geral**: um perfil do Stream Deck com as 8 actions do core organizadas (2 fileiras
   de 4), mostrando números reais.
2. **Property Inspector — período**: captura da tela de configuração da action "Commits" com o
   dropdown de período aberto.
3. **Ação "Status da Conta"**: uma captura no estado OK (verde) e outra simulando o estado de
   erro (vermelho/alerta), para mostrar o diagnóstico funcionando.
4. **Close-up dos ícones**: grid dos 8 ícones da action list (o `contact_sheet.png` gerado
   durante a Fase 4 pode servir de referência de composição, mas não deve ser usado como
   screenshot final — é só um teste de legibilidade, não arte de produto).

## Checklist antes de submeter

- [ ] Substituir `[preencher]` acima (URL de suporte, URL da política de privacidade).
- [ ] Capturar os screenshots reais listados acima.
- [ ] Criar conta de Maker em maker.elgato.com.
- [ ] Confirmar com o suporte da Elgato se algum passo adicional de assinatura/certificado é
      necessário para o SO Windows (ver STEPS.md, item 5.3 — documentação pública não menciona
      isso, mas vale confirmar no onboarding).
