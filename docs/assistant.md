# Fia — arquitetura da assistente de IA

Como a assistente da spec 010 funciona por dentro. Para o uso no dia a dia,
veja o [guia do usuário](user-guide.md); para a decisão docs-no-prompt,
[ADR-011](adr/011-docs-no-prompt-direto.md).

## Visão geral

```
navegador ──POST /assistant/chat──▶ AssistantController (SSE)
                                        │ precheck: 503 sem chave · 429 >10/min/usuário
                                        ▼
                                  AssistantService
                                        │ janela: últimas 10 mensagens
                                        │ system prompt = identidade + usuário + docs
                                        ▼
                              AssistantModelClient (Anthropic SDK)
                                        │ stop_reason == tool_use?
                                        ▼
                              AssistantToolsService ──▶ Prisma com escopo de tenant
                                        │ (espelha RN-12/RN-14)
                                        └──▶ tool_result volta ao modelo (máx. 5 rodadas)
```

- A chave (`ANTHROPIC_API_KEY`) vive SÓ no servidor. Sem ela, os endpoints
  respondem **503 amigável** — o restante do sistema não depende da Fia.
- Modelo configurável via `ASSISTANT_MODEL` (default `claude-sonnet-4-20250514`).
- O front consome SSE (`data: {"type":"text"|"tool"|"done"|"error",...}`) e
  mostra "consultando…" enquanto uma tool roda. Histórico apenas em memória da
  sessão.

## System prompt

Montado por requisição em `assistant.service.ts`:

1. **Identidade**: "Você é a Fia, a assistente da oficina dentro do OFIX…"
2. **Quem pergunta**: nome, papel e escopo de filial do usuário logado.
3. **Limites**: só uso do OFIX + dados do tenant; recusa educada fora disso;
   pt-BR curto; citar a TELA e o BOTÃO; nunca inventar números.
4. **Documentação completa do produto**: `context.generated.md`
   (guia + regras + fluxos), gerado por `pnpm assistant:context` e verificado
   no CI (`assistant:context:check`) — copiado para `dist` via assets do
   nest-cli.

## Tools (somente leitura)

| Tool | Consulta | Escopo herdado |
|---|---|---|
| `get_order_by_code` | OS por código com cliente/técnico/prazo | tenant + filial fixa + técnico só as dele |
| `search_orders` | até 10 OS por status/prioridade | idem |
| `search_customer` | clientes por nome + últimas 3 OS | OS filtradas pelo escopo |
| `get_dashboard_summary` | métricas do período (RN-14) | via `DashboardService.summary` |
| `get_overdue_orders` | OS com prazo vencido em andamento | idem |

Toda query passa pelo client Prisma com extensão de tenant (ADR-002) — não há
caminho para a Fia ler outro tenant. Erros de tool viram texto amigável no
`tool_result`, nunca stack trace. Escrita via chat está no backlog (exigiria
confirmação explícita).

## Insights do dashboard

`POST /assistant/dashboard-insights`: o backend monta o resumo numérico
(mesmas queries do dashboard, mesmo escopo RN-14) e pede **3 a 5 insights
acionáveis** em JSON estrito, validado com Zod; parse inválido → 1 retry →
**503 "Análise indisponível"**. Cache em memória de **15 minutos** por
tenant+filtro (+usuário quando técnico) para conter custo.

## Limites e proteção

- **10 requisições/min por usuário** (janela deslizante em memória; 429 ANTES
  de abrir o stream).
- **Janela de 10 mensagens** enviadas ao modelo por turno.
- **Máx. 5 rodadas de tools** por resposta.
- Falha do provedor durante o stream → evento `error` com mensagem amigável.

## Testes

`assistant.integration.spec.ts` (7 testes): o `AssistantModelClient` é
substituído por um fake roteirizado — o loop de tools roda contra o banco
REAL, provando o isolamento de tenant na prática; janela, rate limit, retry de
JSON, cache e o 503 sem chave também cobertos.
