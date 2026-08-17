# Política de Privacidade — GitHub Metrics (plugin Stream Deck)

Última atualização: 2026-08-17

## Resumo

O plugin **GitHub Metrics** não coleta, armazena, nem transmite nenhum dado pessoal para
servidores do desenvolvedor. Todos os dados exibidos vêm diretamente da sua própria conta do
GitHub, através do **GitHub CLI (`gh`)** já instalado e autenticado na sua máquina.

## Como o plugin funciona

- O plugin executa comandos do `gh` localmente no seu computador (ex.: `gh api user`,
  `gh search prs`, `gh api graphql`) para consultar métricas da sua conta GitHub.
- A autenticação é inteiramente gerenciada pelo `gh` (via `gh auth login`) — o plugin nunca lê,
  armazena, copia ou transmite o seu token de acesso do GitHub.
- Toda comunicação de dados acontece **diretamente entre a sua máquina e os servidores do
  GitHub** (`api.github.com`), usando a sua própria sessão autenticada do `gh`. O desenvolvedor
  do plugin não opera nenhum servidor intermediário e não tem acesso a essa comunicação.

## Dados armazenados localmente

O plugin guarda, apenas no seu computador (nas Settings do próprio Stream Deck), as seguintes
configurações que você define:

- Nome de usuário do GitHub (opcional — se vazio, é detectado automaticamente).
- Caminho customizado para o binário do `gh` (opcional).
- Intervalo de atualização, em segundos.
- Período selecionado (hoje/semana/mês/ano) nas actions de Commits e Reviews.

Nenhuma dessas informações sai do seu computador através do plugin.

## Dados de terceiros

Os dados exibidos (PRs, issues, notificações, commits, reviews, estrelas) são fornecidos pela
API do GitHub e estão sujeitos aos [Termos de Serviço](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
e à [Política de Privacidade do GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

## Telemetria

O plugin não envia telemetria, analytics, nem relatórios de erro para nenhum servidor de
terceiros. Logs de execução (para diagnóstico) ficam salvos apenas localmente, na pasta de logs
do próprio Stream Deck.

## Contato

Dúvidas sobre esta política: [preencher e-mail/URL de suporte antes da submissão].
