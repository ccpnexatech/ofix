# ADR-012 — Fia determinística local por padrão (o trator, não a Ferrari)

- **Status:** aceita
- **Data:** 2026-06-11

## Contexto

A spec 010 previa a Fia sobre a API da Anthropic. Na revisão com o Caio,
pesaram três fatos: (1) é um projeto de demonstração — não queremos custo
recorrente nem expor IA generativa ainda; (2) o domínio é FECHADO: as
respostas "como faço X?" já estão escritas no guia do usuário, e as perguntas
sobre dados ("quais OS atrasadas?") têm resposta exata via tools; (3) a API
paga é uma Ferrari para arar uma fazenda — o que precisamos aqui é um trator.

A técnica é anterior aos LLMs (a intuição do Caio foi o Akinator): detecção de
intenção por padrões + busca por palavras-chave sobre uma base fechada +
templates de resposta. Sem acesso a nada além dos documentos anexados e do
banco do tenant — incapaz de alucinar por construção.

## Decisão

1. **`ASSISTANT_MODE=local` (padrão):** um `LocalAssistantModel` substitui o
   provedor externo ATRÁS da mesma interface (`AssistantModelClient`). Todo o
   pipeline permanece intacto — SSE, loop de tools, janela, rate limit, cache
   de insights, UI. Custo zero, nenhuma chamada externa.
2. O respondedor local opera em três camadas, nesta ordem:
   - **Intenção de dados** (código de OS, "atrasadas", cliente, métricas,
     listagem por status) → emite `tool_use`; o loop executa a tool REAL no
     banco com o escopo do usuário; a resposta final é um template pt-BR
     preenchido com o resultado.
   - **Dúvida de uso** → busca por palavras-chave (normalizadas, sem acento,
     sem stopwords) nas seções do `context.generated.md` e devolve o trecho
     mais relevante do guia.
   - **Fallback honesto** → "não encontrei" + sugestões clicáveis.
3. **Insights do dashboard** idem: regras determinísticas sobre as mesmas
   métricas (atrasos, taxa de aprovação, receita, gargalo por status) no
   formato JSON estrito que o contrato já valida.
4. **`ASSISTANT_MODE=anthropic`** mantém o caminho da spec 010 intacto
   (`AnthropicModelClient` + `ANTHROPIC_API_KEY`) — trocar de trator para
   Ferrari é mudar uma variável de ambiente. Self-hosted (Ollama) anotado no
   backlog.

## Consequências

- Demo funcional com R$ 0,00, respostas auditáveis e determinísticas, e uma
  decisão de engenharia defensável no portfólio: escolher a ferramenta pelo
  problema, não pelo hype.
- Perde-se flexibilidade de linguagem natural: perguntas fora dos padrões
  caem no fallback. Mitigado pelas sugestões na UI e pelos sinônimos do
  classificador.
- Dois provedores atrás de uma interface = a fronteira certa já testada (os
  testes de integração da Fase 11 já substituíam o cliente).
