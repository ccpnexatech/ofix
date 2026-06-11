# SPEC 012 — Documentação Completa de Uso da Ferramenta (última spec)

> Executada na Fase 10, DEPOIS dos E2E (Fase 9), porque consome os screenshots gerados por `pnpm shots` (spec 008). É a documentação que um dono de assistência técnica leria — e também o contexto que alimenta a assistente Fia (spec 010). Clareza absoluta, pt-BR, zero jargão técnico.

## Artefato principal: `docs/user-guide.md`

Estrutura obrigatória (cada seção com screenshot real de `docs/assets/screens/`):

1. **O que é o OFIX** — 3 parágrafos, papel de cada perfil (dono/ADMIN, técnico, atendente).
2. **Primeiros passos** — login, tema claro/escuro, o tour guiado (`?`), o balão da Fia.
3. **A vida de uma OS** (capítulo central) — narrativa do fluxo completo seguindo a história de uma OS real do seed ("o notebook da Dona Maria"): chegada no balcão → wizard → atribuição → diagnóstico → montagem do orçamento → envio do link ao cliente → **como o cliente vê e aprova pelo celular** (screenshots mobile da `/q/`) → reparo → pronta → entrega → garantia. Cada passo: screenshot + quem faz (papel) + onde clicar.
4. **Orçamentos em detalhe** — itens (peça × mão de obra), versões, expiração de 7 dias, reenvio, aprovação presencial pelo ADMIN, recusa e o que fazer depois.
5. **Garantia** — o que a regra de 90 dias significa na prática, como reabrir, o que é cobrado e o que não é (RN-07 em linguagem humana).
6. **Clientes e equipamentos** — cadastro, histórico, busca.
7. **Dashboard** — o que cada métrica significa (definições da spec 005 traduzidas), seletor de filiais, comparativo, leitura do card "Análise da IA".
8. **Filiais e o mapa público** — visão por filial, escopo de usuários por filial, como compartilhar o link do mapa com clientes e como rotacionar o link (aponta para `docs/scripts.md`).
9. **Usuários e permissões** — tabela da matriz de permissões em linguagem simples + como criar usuários.
10. **Perguntas frequentes** — mínimo 10 (ex.: "o cliente perdeu o link do orçamento", "posso cancelar uma OS entregue?", "por que não consigo mover a OS para reparo?" — cada resposta explica a regra de negócio por trás).
11. **Glossário** — OS, orçamento, garantia, filial, status (um a um, com a cor do badge).

## Artefatos complementares (consolidar/atualizar nesta fase)

- `docs/flows.md` — diagramas Mermaid: máquina de estados, sequência da aprovação pública, fluxo de garantia.
- `docs/scripts.md` — guia operacional dos scripts (criação de tenant/filial/usuário, rotação do token do mapa) com exemplos copiáveis e saídas reais.
- `docs/database.md` — revisão final do ERD + dicionário (já criados na Fase 1).
- `docs/api-reference.md` — revisão final, 100% dos endpoints.
- `docs/README.md` — índice navegável de toda a documentação (mapa do site dos docs).
- Sincronizar textos dos tours (spec 009) com a terminologia do guia.
- Regenerar o contexto da Fia (`pnpm assistant:context`) após fechar o guia.

## Critérios de qualidade

- Teste do usuário leigo: uma pessoa sem contexto técnico consegue executar o fluxo completo só com o guia.
- Todo screenshot tem legenda e callout (seta/destaque) quando o alvo não é óbvio — padronizar callouts em âmbar.
- Nenhuma seção órfã: tudo que existe na UI aparece no guia; tudo que está no guia existe na UI.
- Linguagem: voz ativa, segunda pessoa ("clique", "você verá"), frases curtas.

## Definition of Done (Fase 10)

- [x] `docs/user-guide.md` completo com as 11 seções e screenshots reais nos pontos definidos.
- [x] FAQ com ≥ 10 entradas e glossário completo. — 12 perguntas + glossário com os 9 status
- [x] `docs/README.md` (índice) criado; flows/scripts/database/api revisados. — flows.md novo com 3 diagramas
- [x] Contexto da Fia regenerado e CI de verificação passando. — `pnpm assistant:context[:check]`
- [x] Leitura completa de revisão (typos, links quebrados — checar com lychee ou similar). — checker próprio: 19 arquivos, zero quebrados
