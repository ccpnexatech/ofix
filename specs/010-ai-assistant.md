# SPEC 010 — Assistente de IA (Chat + Insights do Dashboard)

## Visão

Balão flutuante (canto inferior direito, todas as telas autenticadas) abre um painel de chat com a assistente **"Fia"** (assistente da oficina). Ela conhece a documentação do produto, responde dúvidas de uso e consulta dados reais do tenant via tools. No dashboard, um card "Análise da IA" gera feedback textual sobre as métricas exibidas. **Recurso padrão para todos os tenants.**

## Backend (`apps/api/src/modules/assistant`) — Anthropic SDK

- `POST /assistant/chat` `{ messages }` → **streaming SSE** da resposta. Modelo via env (`ASSISTANT_MODEL`, default `claude-sonnet-4-20250514`), chave `ANTHROPIC_API_KEY` somente no servidor — **o front NUNCA toca a chave**.
- **Contexto de produto:** build step (`pnpm assistant:context`) concatena `docs/user-guide.md`, `docs/business-rules.md` e `docs/flows.md` em `apps/api/src/modules/assistant/context.generated.md` (commitado; CI falha se desatualizado vs. docs — script de verificação). Esse conteúdo entra no system prompt. ADR-011: docs no prompt direto (tamanho atual permite); RAG anotado no backlog como evolução.
- **System prompt define:** identidade da Fia, escopo (uso do OFIX e dados do tenant do usuário — payload inclui nome/papel/filial), recusa educada fora do escopo, pt-BR, respostas curtas, instrução de citar a tela onde a ação é feita.
- **Tools (function calling), todas executadas pelos services existentes — herdam tenant scope e RBAC do usuário logado automaticamente:**
  | Tool | Faz |
  |---|---|
  | `get_order_by_code(code)` | Status, cliente, técnico, etapa atual de uma OS |
  | `search_orders(filters)` | Lista resumida por status/filial/prioridade/atraso |
  | `search_customer(name)` | Cliente + últimas OS |
  | `get_dashboard_summary(branchId?)` | Métricas do período |
  | `get_overdue_orders(branchId?)` | OS atrasadas |
- Segurança: tools são **somente leitura** nesta versão (escrita via chat = backlog, exigiria confirmação explícita). Limite de 10 mensagens por conversa enviadas ao modelo (janela deslizante) + rate limit 10 req/min/usuário. Erros do provedor → mensagem amigável, nunca stack trace.

## Insights do dashboard

- `POST /assistant/dashboard-insights` `{ branchId?, from?, to? }`: o backend monta o resumo numérico (mesmas queries do dashboard) e pede ao modelo **3 a 5 insights acionáveis em pt-BR** (ex.: "A taxa de aprovação de orçamentos caiu de 78% para 61% neste mês — revise os valores de mão de obra ou o tempo de resposta"). Resposta JSON estrita validada com Zod; falha de parse → retry único → fallback "análise indisponível".
- Card no dashboard: estado vazio com botão "Gerar análise", loading com skeleton, resultado com horário de geração e botão refresh. Cache de 15 min por tenant+filtro (evita custo repetido).

## Frontend (`features/assistant/`)

- Balão com a marca da Fia; painel lateral (Sheet) com histórico da sessão, streaming token a token, indicação visual quando uma tool é consultada ("consultando suas OS…"), markdown básico renderizado, botão limpar conversa. Histórico apenas em memória da sessão (privacidade; persistência = backlog).
- Sugestões iniciais clicáveis: "Como aprovo um orçamento presencialmente?", "Quais OS estão atrasadas?", "Como funciona a garantia?".

## Definition of Done (Fase 11)

- [ ] Chat com streaming SSE funcionando ponta a ponta com as 5 tools (testes de integração das tools com tenant isolation; chamada ao modelo mockada nos testes).
- [ ] Script de contexto + verificação de atualização no CI.
- [ ] Card de insights com cache e os 3 estados de UI.
- [ ] Rate limit e janela de mensagens testados.
- [ ] ADR-011 escrito; `docs/assistant.md` documentando arquitetura, prompt e tools.
- [ ] Demonstração no README (gif do chat respondendo com dado real do seed).
