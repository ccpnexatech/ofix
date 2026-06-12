# Backlog — evoluções conscientemente adiadas

Regra do projeto: ideia fora de spec NUNCA vira código por impulso — vira uma
entrada aqui, com origem e gatilho. Nada abaixo bloqueia o uso do produto.

## Assistente (Fia)

- **Modelo self-hosted (Ollama):** terceiro provedor atrás do
  `AssistantModelClient` (ADR-012) falando o protocolo OpenAI-compatível —
  meio-termo entre o modo local determinístico e a API paga.
- **RAG sobre a documentação** (origem: ADR-011): hoje os docs inteiros cabem
  no prompt (~25 KB). Gatilho: contexto > 50 KB ou latência > 3s no modo
  `anthropic`.
- **Escrita via chat** (origem: spec 010): tools hoje são somente leitura por
  segurança; escrever exigiria confirmação explícita do usuário na UI.
- **Histórico de conversa persistente** (origem: spec 010): hoje é memória da
  sessão, por privacidade. Exigiria política de retenção.

## Produto

- **Desativação de filial na UI** (origem: ADR-013): criar/editar filial é
  self-service do ADMIN, mas desativar exige política para usuários com escopo
  fixo (RN-12) e OS abertas da filial. Gatilho: primeiro tenant que fechar uma
  unidade.
- **Troca de senha self-service** (origem: FAQ do guia): hoje o admin redefine
  em Usuários. Exigiria fluxo de e-mail (provedor de envio ainda não existe no
  projeto).
- **Notificações ao cliente (WhatsApp/SMS/e-mail)** (origem: spec 004, RN-03):
  o envio do link público hoje é manual (copiar e colar) — decisão da spec
  para não acoplar provedor externo na demo.

## Infra

- **Job de expiração via fila** (origem: ADR/spec 004, RN-05): a expiração
  lazy + sweep diário cobre o caso; fila dedicada só se surgir SLA de minutos.
- **Renovação silenciosa de access token via timer** (origem: spec 003): hoje
  renova no primeiro 401; timer pró-ativo é refinamento de UX.
