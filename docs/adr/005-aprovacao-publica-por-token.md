# ADR-005 — Aprovação de orçamento pelo cliente via token público, sem login

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

O cliente final da assistência (dono do equipamento) precisa aprovar ou recusar
o orçamento. Exigir cadastro/login de alguém que interage com a oficina uma vez
por ano mataria a conversão — a aprovação aconteceria por telefone e o sistema
perderia o registro. A alternativa precisa ser segura o bastante para uma
decisão com efeito financeiro.

## Decisão

1. **Capability URL:** cada versão de orçamento tem um `publicToken` UUID v4
   (122 bits aleatórios) que dá acesso à página pública `/q/{token}`. Possuir o
   link É a credencial — modelo de capability, igual a link de convite.
2. **Vida curta:** o token nasce no envio (`SEND_QUOTE`, RN-03) com
   `tokenExpiresAt = now + 7 dias` e é **regenerado a cada reenvio**. Expirado →
   `410 Gone` com mensagem amigável (RN-05); a oficina reenvia uma nova versão.
3. **Escopo mínimo:** a página expõe somente o necessário para decidir — nome
   da empresa/filial, resumo da OS (código/equipamento), itens, total e
   validade. Nunca dados de outros clientes, OS ou usuários.
4. **Decisão auditada:** approve/reject público executa a MESMA máquina de
   transições da API autenticada e grava `OrderEvent` com `actorType = CUSTOMER`
   e `metadata.method = "public_token"` (ADR-004/006). Recusa exige motivo
   (RN-04). Token inexistente → 404 genérico (sem confirmar existência).
5. **Rate limit** de 20 req/min/IP em todo o namespace `/public/*` (spec 003).

## Consequências

- Aprovação em um toque no celular do cliente, com trilha de auditoria íntegra
  e timestamp — substitui o "aprovou por telefone" indefensável.
- O link pode vazar (encaminhamento de mensagem). Mitigações: expiração de 7
  dias, escopo mínimo de dados, rate limit e renovação a cada envio. Aceito: o
  dano possível é aprovar/recusar um orçamento específico, não acessar a conta.
- Sem autenticação não há identidade forte do aprovador — registra-se o canal
  (token) e o momento. Adequado ao porte; assinatura digital seria o próximo
  passo se o domínio exigisse.
- Alternativas rejeitadas: login do cliente final (atrito fatal), PIN por SMS
  (custo/complexidade sem ameaça que o justifique), aprovação somente presencial
  (perde o diferencial do produto).
