<!--
  GERADO por `pnpm assistant:context` — NÃO edite à mão.
  Fontes: docs/user-guide.md · docs/business-rules.md · docs/flows.md
  Após editar qualquer fonte, rode o comando e commite este arquivo.
-->

<!-- fonte: docs/user-guide.md -->

# Guia de uso do OFIX

> Este guia foi escrito para quem trabalha no balcão, na bancada ou no caixa de
> uma assistência técnica. Sem jargão: cada passo diz **quem faz**, **onde
> clicar** e **o que acontece**. As imagens são telas reais do sistema.

## 1. O que é o OFIX

O OFIX organiza a vida de uma assistência técnica em volta de um único
documento: a **ordem de serviço (OS)**. Da entrada do aparelho no balcão até a
entrega com garantia, tudo fica registrado — quem mexeu, quando, e o que o
cliente aprovou. Nada se perde em papelzinho ou conversa de WhatsApp.

Cada empresa tem o seu espaço completamente separado das demais, com uma ou
mais **filiais**. O sistema mostra para cada pessoa só o que ela precisa: o
**dono (Administrador)** vê tudo, gerencia a equipe e aprova orçamentos
presencialmente; o **técnico** opera as OS atribuídas a ele — diagnostica,
monta orçamento e executa o reparo; o **atendente** cuida do balcão — cadastra
clientes, abre OS, atribui técnico e entrega o aparelho pronto.

O cliente final não precisa de senha: ele recebe um **link** para ver e
aprovar o orçamento pelo celular, e outro link público mostra as filiais da
empresa no mapa.

## 2. Primeiros passos

![Tela de login](assets/screen-login.png)
*Legenda: a tela de entrada. O botão de lua/sol no canto superior direito troca
o tema.*

1. Acesse o endereço do sistema e entre com **e-mail e senha** fornecidos pelo
   administrador. Errou a senha? A mensagem é a mesma para qualquer erro — por
   segurança, o sistema nunca confirma se um e-mail existe.
2. **Tema claro ou escuro**: clique no ícone de lua/sol no topo. A escolha fica
   salva — vale na próxima visita, inclusive na tela de login.
3. **Tour guiado**: na primeira vez em cada tela, um passeio rápido destaca o
   que importa. Use **Próximo/Voltar**, ou **Esc** para pular. Quer rever
   depois? Clique no botão **`?`** no canto inferior esquerdo.

![Tour guiado no dashboard](assets/screen-tour-step1.png)
*Legenda: o tour escurece a tela e ilumina, em âmbar, exatamente o elemento
explicado.*

4. **Fia, a assistente**: o balão no canto inferior direito abre um chat que
   conhece este guia e os seus dados — pergunte "quais OS estão atrasadas?" ou
   "como funciona a garantia?".

## 3. A vida de uma OS — a história do notebook da Dona Maria

Acompanhe o caminho completo usando um caso típico: Dona Maria chega ao balcão
da **Matriz Fortaleza** com um notebook que não liga.

### 3.1 Chegada no balcão (atendente ou admin)

No menu lateral, clique em **Ordens de serviço** e depois no botão âmbar
**+ Nova OS**. Um assistente de 4 passos se abre:

![Wizard de nova OS](assets/screens/wizard/light.png)
*Legenda: os 4 passos no topo mostram onde você está. Pode voltar sem perder
nada.*

- **Passo 1 — Cliente**: busque pelo nome. Dona Maria é cliente nova? Preencha
  nome e telefone ali mesmo — sem sair do fluxo.
- **Passo 2 — Equipamento**: escolha um aparelho já cadastrado dela ou
  descreva o novo (tipo, marca, modelo).
- **Passo 3 — Detalhes**: escreva o defeito relatado ("não liga após queda de
  energia"), defina a prioridade, a filial e, se prometeu prazo, a data.
- **Passo 4 — Revisão**: confira tudo e clique em **Criar OS**.

O sistema gera um código único, tipo **OS-2026-0042**, e abre a tela da OS. O
status nasce como **Recebida**.

### 3.2 Atribuição do técnico (atendente ou admin)

Na tela da OS, no cartão **Equipamento**, clique em **Atribuir técnico** e
escolha quem vai cuidar do caso. Só aparecem técnicos da filial da OS — o
Carlos, da Matriz, não pode receber OS da Aldeota.

### 3.3 Diagnóstico (técnico)

O Carlos abre a OS e, no painel **Ações** à direita, clica em **Iniciar
diagnóstico**. Esse painel é esperto: só mostra os botões válidos para o
status atual **e** para o papel de quem olha. Depois de examinar o aparelho,
ele clica no lápis ao lado de **Diagnóstico técnico** e descreve o problema
(o sistema pede ao menos 20 caracteres — diagnóstico de uma palavra não ajuda
ninguém).

![Tela da OS](assets/screens/detalhe-os/light.png)
*Legenda: a tela central. À esquerda, cliente, equipamento, diagnóstico e
orçamento; à direita, o painel de Ações e a linha do tempo de tudo o que
aconteceu.*

### 3.4 Montagem do orçamento (técnico ou admin)

No cartão **Orçamento**, clique em **Nova versão** e depois **Adicionar item**
para cada linha: escolha **Peça** ou **Mão de obra**, descreva, informe
quantidade e valor. O total soma sozinho. Clique em **Salvar itens** e, quando
estiver pronto, **Enviar ao cliente**.

### 3.5 O cliente aprova pelo celular

Ao enviar, o orçamento ganha um **link público válido por 7 dias**. No cartão
do orçamento, clique em **Copiar link público** e mande para a Dona Maria por
onde preferir (WhatsApp, SMS).

![Orçamento no celular](assets/screens/aprovacao-publica/01-orcamento-mobile.png)
*Legenda: o que a Dona Maria vê no celular — sem instalar nada, sem senha:
a identidade da loja, o aparelho, cada item e o total em destaque.*

Ela confere e toca no botão grande **Aprovar orçamento** (ou em "Prefiro
recusar", informando o motivo). No mesmo instante a OS muda para **Aprovada**
na sua tela, e a linha do tempo registra "pelo cliente · via link público".

![Confirmação de aprovação](assets/screens/aprovacao-publica/02-aprovado.png)
*Legenda: a confirmação que o cliente recebe na hora.*

### 3.6 Reparo e prontidão (técnico)

Com a aprovação, o painel de Ações libera **Iniciar reparo**. Terminou a
bancada? **Marcar como pronta**. A Dona Maria já pode ser avisada.

### 3.7 Entrega (atendente ou admin)

Na retirada, clique em **Entregar**. O sistema grava a data e calcula a
**garantia de 90 dias** automaticamente — o cartão Garantia mostra a data
exata de validade.

![OS entregue com garantia](assets/screens/entrega-garantia/01-entregue-com-garantia.png)
*Legenda: entregue, com a garantia visível. A OS está encerrada — esse status
é definitivo.*

### 3.8 E se o problema voltar? (garantia)

Se o notebook falhar de novo dentro dos 90 dias, abra a OS original e clique
em **Reabrir em garantia**. O sistema cria uma **nova OS** ligada à primeira,
já com prioridade **Alta** — cliente de garantia não espera fila.

![OS filha de garantia](assets/screens/entrega-garantia/02-os-filha-garantia.png)
*Legenda: a OS de garantia nasce vinculada — o link "ver OS original" preserva
todo o histórico.*

## 4. Orçamentos em detalhe

- **Peça × mão de obra**: cada item tem um tipo. Isso importa na garantia
  (seção 5) e na leitura do cliente.
- **Versões**: orçamento recusado ou expirado não se edita — cria-se a
  **versão 2** (botão Nova versão). As anteriores ficam guardadas num
  histórico expansível, com motivo da recusa quando houver.
- **Validade de 7 dias**: o link público expira. Se a Dona Maria demorar, o
  link mostra "este orçamento expirou" — basta criar nova versão e reenviar
  (um link novinho é gerado a cada envio).
- **Cliente perdeu o link?** Abra a OS e clique em **Copiar link público** de
  novo — o link atual continua o mesmo até expirar ou ser reenviado.
- **Aprovação presencial**: cliente decidiu no balcão? O **Administrador** usa
  os botões **Aprovar (presencial)** / **Recusar (presencial)** no painel de
  Ações. A recusa pede o motivo (mínimo 5 caracteres) — ele aparece na linha
  do tempo e no histórico de versões.
- **Depois da recusa**: converse com o cliente, monte a versão 2 com outros
  valores e reenvie — ou cancele a OS informando o motivo.

## 5. Garantia sem mistério

A regra dos **90 dias** (contados da entrega) significa: se o mesmo serviço
apresentar problema, **a mão de obra não é cobrada de novo**. Na prática:

- O orçamento da OS de garantia já nasce com os serviços originais **zerados**,
  identificados como "Garantia — ...".
- **Peças novas podem ser cobradas** — se a fonte queimou de novo por outro
  motivo, a peça entra no orçamento normalmente.
- Passou dos 90 dias? O sistema bloqueia a reabertura e mostra a data limite.
  Abra uma OS comum, cobrável.
- Reabrir em garantia **não reabre a OS original** — ela permanece "Entregue"
  para sempre; o reparo novo vive na OS filha, com seu próprio histórico.

## 6. Clientes e equipamentos

![Lista de clientes](assets/screens/clientes/light.png)
*Legenda: busque por nome, telefone ou e-mail. Clique na linha para abrir o
perfil.*

- **Cadastrar**: botão **Novo cliente** (nome e telefone bastam) — ou direto
  no passo 1 do assistente de OS.
- **Perfil**: contato, todos os equipamentos da pessoa e o histórico completo
  de OS — útil quando o cliente diz "é a terceira vez que esse notebook vem
  aqui".
- **Equipamentos**: um cliente pode ter vários. Cadastre pelo perfil ou no
  passo 2 do assistente. O número de série ajuda a não confundir aparelhos
  iguais.

## 7. Dashboard — os números do negócio

![Dashboard](assets/screens/dashboard/light.png)
*Legenda: a visão de chegada do dia. No topo direito, o seletor de filial.*

O que cada cartão significa:

| Métrica | Em palavras |
|---|---|
| **OS abertas** | Tudo que ainda não foi entregue nem cancelado |
| **Atrasadas** | OS com prazo prometido já vencido e ainda em andamento |
| **Receita do mês** | Soma dos orçamentos aprovados das OS **entregues** no mês — entrega é o que conta, não a aprovação |
| **Ticket médio** | Receita do mês dividida pelas entregas do mês |
| **Taxa de aprovação** | De cada 100 orçamentos decididos no período, quantos o cliente aprovou |
| **Tempo médio de reparo** | Da entrada do aparelho até a entrega, em dias |

- **Seletor de filial** (topo): "Todas as filiais" ou uma específica — o
  filtro fica no endereço da página, então dá para compartilhar a visão exata.
  Usuário vinculado a uma filial vê o seletor travado nela.
- **Gráfico de receita**: os últimos 6 meses, para enxergar tendência.
- **OS por status**: o anel usa as mesmas cores dos selos de status.
- **Atrasadas e urgentes**: a lista do que precisa de você agora — clique no
  código para abrir.
- **Comparativo entre filiais** (só Administrador): abertas, atrasadas,
  entregas e receita de cada unidade, lado a lado.
- **Análise da IA**: a Fia lê esses mesmos números e devolve um diagnóstico em
  texto — clique em **Gerar análise** quando quiser uma leitura interpretada.

## 8. Filiais e o mapa público

![Mapa de filiais](assets/screens/mapa-filiais/light.png)
*Legenda: menu Filiais — suas unidades no mapa, com endereço e telefone.*

- Cada OS pertence a **uma** filial (o aparelho está fisicamente em algum
  lugar). Usuários podem ser da filial ou do tenant inteiro — quem é "da
  Aldeota" só vê e opera o que é da Aldeota.
- **Abriu uma unidade nova?** O Administrador cadastra pelo botão
  **Nova filial** (e edita pelo lápis em cada cartão). Preencha latitude e
  longitude para a unidade entrar no mapa — sem elas, fica só na lista.
- **Compartilhe o mapa**: o botão **Copiar link público** gera um endereço que
  qualquer cliente abre sem senha, com pins, telefone clicável e botão "como
  chegar".

![Mapa público no celular](assets/screens/mapa-publico/01-mapa-mobile.png)
*Legenda: o que o cliente vê — ideal para a bio do Instagram da loja.*

- **Trocar o link** (se vazou onde não devia): a rotação é feita pelo
  operador do sistema via script — veja [scripts.md](scripts.md).
  O link antigo morre na hora.
- Filial sem coordenadas cadastradas não aparece no mapa (a lista avisa).

## 9. Usuários e permissões

![Gestão de usuários](assets/screens/usuarios/light.png)
*Legenda: menu Usuários (só o Administrador vê). Crie, desative e defina o
escopo de filial.*

Quem pode o quê, em linguagem direta:

| O que | Admin | Técnico | Atendente |
|---|---|---|---|
| Abrir OS, cadastrar cliente/equipamento | ✓ | — | ✓ |
| Atribuir técnico | ✓ | — | ✓ |
| Diagnosticar, orçar, reparar, marcar pronta | ✓ | ✓ *(só nas OS dele)* | — |
| Aprovar/recusar orçamento no balcão | ✓ | — | — |
| Entregar ao cliente | ✓ | — | ✓ |
| Cancelar OS | ✓ | — | — |
| Reabrir em garantia | ✓ | — | ✓ |
| Gerenciar usuários | ✓ | — | — |
| Dashboard | tudo | só as OS dele | a filial dele (ou todas, se não tiver filial fixa) |

**Criar usuário**: botão **Novo usuário** → nome, e-mail, senha inicial (peça
para trocar no primeiro acesso), papel e filial. "Todas as filiais" = acesso
ao tenant inteiro.

## 10. Perguntas frequentes

1. **O cliente perdeu o link do orçamento. E agora?**
   Abra a OS → cartão Orçamento → **Copiar link público** e reenvie. O link só
   muda quando o orçamento é reenviado ou expira.

2. **O link do orçamento "expirou". O que faço?**
   O link vale 7 dias (segurança: ele dá acesso sem senha). Crie uma **nova
   versão** do orçamento e clique em Enviar — nasce um link novo.

3. **Posso cancelar uma OS entregue?**
   Não. Entregue é estado final — o histórico daquilo que o cliente levou não
   se reescreve. Problema depois da entrega? É caso de **garantia** (nova OS
   vinculada).

4. **Por que não consigo mover a OS para "Em reparo"?**
   O reparo só começa **depois** que o cliente aprova o orçamento. A ordem é
   sempre: diagnóstico → orçamento enviado → aprovado → reparo. O painel de
   Ações só mostra o passo que vale agora.

5. **Por que o botão "Iniciar diagnóstico" não aparece?**
   Duas causas: a OS ainda não tem **técnico atribuído** (atribua primeiro),
   ou você não é o técnico daquela OS — técnico só opera as próprias.

6. **O cliente recusou. Perdi o orçamento?**
   Não — a versão recusada fica no histórico, com o motivo. Monte a versão 2
   (outros valores, outras peças) e reenvie.

7. **Cadastrei o cliente na filial errada. A OS também?**
   Cliente é da empresa toda; o que tem filial é a **OS**. OS criada na filial
   errada: cancele com o motivo e abra na certa — a linha do tempo preserva o
   registro.

8. **Por que o atendente da Aldeota não encontra uma OS da Matriz?**
   Por desenho: usuário com filial fixa só enxerga a unidade dele. Quem
   precisa ver tudo (dono, gerente geral) deve ser cadastrado com "Todas as
   filiais".

9. **A mão de obra é cobrada na garantia?**
   Dos **mesmos serviços**, não — o orçamento da OS de garantia já vem com
   eles zerados. Peças novas e serviços diferentes podem ser cobrados.

10. **Quem aprovou esse orçamento? O cliente jura que não foi ele.**
    Abra a linha do tempo da OS: cada decisão registra quem fez (equipe,
    cliente pelo link, ou sistema), quando, e por qual via — "via link
    público" ou "presencial".

11. **Esqueci minha senha.**
    Peça ao Administrador: ele cria uma senha nova em Usuários (a troca pelo
    próprio usuário está no roteiro de evolução).

12. **O tour sumiu e eu queria rever uma tela.**
    Botão **`?`** no canto inferior esquerdo, em qualquer tela que tenha tour.

## 11. Glossário

| Termo | Significado |
|---|---|
| **OS (ordem de serviço)** | O documento que acompanha um conserto do início ao fim, com código único (ex.: OS-2026-0042) |
| **Orçamento** | A proposta de valores de um conserto, com itens de peça e mão de obra; pode ter várias versões |
| **Garantia** | 90 dias após a entrega em que a mão de obra dos mesmos serviços não é cobrada de novo |
| **Filial** | Unidade física da empresa; toda OS pertence a uma |
| **Tenant** | O espaço isolado da sua empresa no sistema — ninguém de fora enxerga nada |
| **Link público** | Endereço sem senha para o cliente decidir o orçamento (validade 7 dias) ou ver o mapa de filiais |

**Status da OS** (cor do selo em toda tela):

| Selo | Significado |
|---|---|
| 🔵 **Recebida** | Entrou no balcão, aguardando triagem |
| 🟣 **Em diagnóstico** | Técnico investigando o defeito |
| 🟠 **Orçamento enviado** | Aguardando a decisão do cliente |
| 🩵 **Aprovada** | Cliente disse sim — pronta para a bancada |
| 🌹 **Recusada** | Cliente disse não — cabe nova versão ou cancelamento |
| 🟧 **Em reparo** | Mãos à obra |
| 🟢 **Pronta** | Reparo concluído, aguardando retirada |
| ✅ **Entregue** | Cliente levou; garantia correndo (estado final) |
| ⚪ **Cancelada** | Encerrada sem conclusão, com motivo registrado (estado final) |

---

<!-- fonte: docs/business-rules.md -->

# Regras de negócio (RN-01..RN-15)

Fonte: spec 004. Cada regra tem teste com o código no nome (`pnpm test` em
`apps/api` e `packages/shared`). A máquina de estados é uma função pura em
[`packages/shared/src/order-state-machine.ts`](../packages/shared/src/order-state-machine.ts),
consumida pela API (validar) e pelo web (decidir botões) — divergência é
impossível por construção.

## Máquina de estados da OS

```mermaid
stateDiagram-v2
    [*] --> RECEIVED: criação da OS
    RECEIVED --> IN_DIAGNOSIS: START_DIAGNOSIS (RN-02)
    IN_DIAGNOSIS --> QUOTE_SENT: SEND_QUOTE (RN-03)
    QUOTE_SENT --> QUOTE_SENT: SEND_QUOTE (nova versão, RN-05)
    QUOTE_SENT --> APPROVED: APPROVE_QUOTE (RN-04)
    QUOTE_SENT --> REJECTED: REJECT_QUOTE (RN-04)
    REJECTED --> QUOTE_SENT: SEND_QUOTE (nova versão)
    APPROVED --> IN_REPAIR: START_REPAIR
    IN_REPAIR --> READY: MARK_READY
    READY --> DELIVERED: DELIVER (RN-06)
    RECEIVED --> CANCELED: CANCEL (RN-08)
    IN_DIAGNOSIS --> CANCELED: CANCEL
    QUOTE_SENT --> CANCELED: CANCEL
    APPROVED --> CANCELED: CANCEL
    REJECTED --> CANCELED: CANCEL
    IN_REPAIR --> CANCELED: CANCEL
    READY --> CANCELED: CANCEL
    DELIVERED --> [*]: terminal (garantia cria NOVA OS, RN-07)
    CANCELED --> [*]: terminal
```

A API muda status **somente** por `POST /orders/:id/transitions { action }`
([ADR-006](adr/006-endpoint-unico-de-transicoes.md)). `REOPEN_WARRANTY` não é
uma transição: cria uma OS filha vinculada e a original permanece DELIVERED.

## Regras de transição e domínio

- **RN-01 — Transição fora do mapa → 422.** Ex.: `DELIVER` numa OS
  `IN_DIAGNOSIS` responde `422 { details: { code: "RN-01" } }`. O teste cobre o
  produto cartesiano completo status × ação (72 combinações).
- **RN-02 — Diagnóstico exige técnico.** `START_DIAGNOSIS` sem
  `assignedTechnicianId` → 422 RN-02. Atribua antes com `POST /orders/:id/assign`.
- **RN-03 — Envio de orçamento.** `SEND_QUOTE` exige `technicalDiagnosis` com
  ≥ 20 caracteres E um orçamento DRAFT com ≥ 1 item e total > 0. Ao executar, o
  orçamento vira SENT com `publicToken` novo e validade de 7 dias.
- **RN-04 — Decisão do orçamento.** Aprovação/recusa acontece (a) pelo cliente
  via link público (`/public/quotes/:token`, evento com `actorType = CUSTOMER`
  e `method = "public_token"`, ADR-005) ou (b) presencialmente por um ADMIN
  (`method = "in_person"`). Recusa exige motivo ≥ 5 caracteres.
- **RN-05 — Expiração do orçamento.** Quote SENT com token vencido é tratada
  como EXPIRED: avaliação lazy ao acessar (link público, criação de nova versão,
  transições) + varredura no boot e diária às 03h, com evento `QUOTE_EXPIRED`
  (actor SYSTEM). A OS permanece QUOTE_SENT e uma versão N+1 pode ser criada e
  enviada. Link expirado na rota pública → 410 Gone com mensagem amigável.
- **RN-06 — Entrega.** `DELIVER` grava `deliveredAt = now` e
  `warrantyUntil = deliveredAt + 90 dias`. Ex.: entregue em 10/06 → garantia
  até 08/09.
- **RN-07 — Reabertura em garantia.** Só com `now <= warrantyUntil` (senão 422
  citando a data). Cria NOVA OS: `warrantyParentId` aponta para a original,
  mesma filial/cliente/equipamento, prioridade mínima HIGH (URGENT é
  preservada), status RECEIVED. Mão de obra dos mesmos serviços não é
  recobrável — a quote da OS de garantia nasce com os itens LABOR da quote
  aprovada original zerados e prefixados com "Garantia — " (referência).
- **RN-08 — Cancelamento.** Exige motivo ≥ 10 caracteres, é terminal e proibido
  a partir de DELIVERED (que só sai via garantia).
- **RN-09 — Auditoria transacional.** Toda transição grava `OrderEvent` na
  MESMA `$transaction` ([ADR-004](adr/004-auditoria-append-only.md)). Falhou o
  evento, falhou a transição. `GET /orders/:id/events` é a linha do tempo.
- **RN-10 — Código da OS.** `OS-{ANO}-{NNNN}` sequencial por tenant+ano via
  `OrderCodeSequence` com `INSERT ... ON CONFLICT` + incremento atômico na
  transação de criação. Teste: 20 criações paralelas → 20 códigos únicos.

## Multi-tenant e filial

- **RN-11 — Isolamento de tenant.** Imposto pela Prisma Extension (ADR-002);
  todo endpoint tem teste `expectTenantIsolation` (tenant B → 404/403 em
  recurso do tenant A).
- **RN-12 — Escopo de filial.** Usuário com `branchId` fixo só enxerga/opera OS
  da sua filial (lista é forçada; pedir outra filial → 403; criar em outra
  filial → 403). `branchId = null` → tenant inteiro.
- **RN-13** (= RN-10 por escopo): a sequência é por tenant — dois tenants podem
  ter cada um a sua `OS-2026-0001` (testado).
- **RN-14 — Dashboard** (Fase 7): agregação padrão = tenant; `?branchId=`
  filtra; usuário de filial fixa não consulta agregado de outra filial (403).
- **RN-15 — Mapa público** (Fase 7): `publicMapToken` expõe SOMENTE filiais
  ativas com lat/lng (nome, endereço, telefone, cidade). Nunca OS, clientes ou
  usuários. Token rotacionável via `scripts/rotate-map-token.ts`.

## Matriz de permissões

Aplicada em dois níveis: `@Roles()` na rota e regras por ação no service de
transições (técnico só opera OS atribuídas a si). Testada de forma tabular
(`test.each`, 31 linhas) em
[`permissions-matrix.integration.spec.ts`](../apps/api/src/modules/orders/permissions-matrix.integration.spec.ts).

| Ação | ADMIN | TECHNICIAN | ATTENDANT |
|---|---|---|---|
| Criar OS / cliente / equipamento | ✓ | — | ✓ |
| Atribuir técnico | ✓ | — | ✓ |
| START_DIAGNOSIS / SEND_QUOTE / START_REPAIR / MARK_READY | ✓ | ✓ (só OS atribuídas a si) | — |
| APPROVE/REJECT presencial | ✓ | — | — |
| DELIVER | ✓ | — | ✓ |
| CANCEL | ✓ | — | — |
| REOPEN_WARRANTY | ✓ | — | ✓ |
| Gerenciar usuários do tenant | ✓ | — | — |
| Dashboard agregado (Fase 7) | ✓ | ✗ (apenas suas OS) | ✓ (sua filial; todas se branchId null) |

Campos editáveis da OS por papel (PATCH): ADMIN edita tudo; ATTENDANT edita
`reportedIssue`/`priority`/`promisedAt` (nunca o diagnóstico); TECHNICIAN edita
somente `technicalDiagnosis` de OS atribuídas a si. Por estado: defeito
relatado e diagnóstico congelam após `QUOTE_SENT` (são a base do que o cliente
aprovou); prioridade e prazo seguem editáveis até estado terminal.

## Definições do dashboard (Fase 7, documentadas desde já)

- **Receita** = soma das quotes APPROVED de OS DELIVERED no período (pela
  `deliveredAt`).
- **Tempo médio de reparo** = média de `deliveredAt - createdAt`.
- **OS atrasada** = `promisedAt < now` e status não-terminal.

---

<!-- fonte: docs/flows.md -->

# Fluxos do OFIX

Diagramas de referência dos três fluxos centrais. A máquina de estados é uma
função pura compartilhada entre API e web
([`order-state-machine.ts`](../packages/shared/src/order-state-machine.ts));
as regras citadas (RN-xx) estão detalhadas em
[business-rules.md](business-rules.md).

## Máquina de estados da OS

```mermaid
stateDiagram-v2
    [*] --> RECEIVED: criação da OS
    RECEIVED --> IN_DIAGNOSIS: START_DIAGNOSIS (RN-02)
    IN_DIAGNOSIS --> QUOTE_SENT: SEND_QUOTE (RN-03)
    QUOTE_SENT --> QUOTE_SENT: SEND_QUOTE (nova versão, RN-05)
    QUOTE_SENT --> APPROVED: APPROVE_QUOTE (RN-04)
    QUOTE_SENT --> REJECTED: REJECT_QUOTE (RN-04)
    REJECTED --> QUOTE_SENT: SEND_QUOTE (nova versão)
    APPROVED --> IN_REPAIR: START_REPAIR
    IN_REPAIR --> READY: MARK_READY
    READY --> DELIVERED: DELIVER (RN-06)
    RECEIVED --> CANCELED: CANCEL (RN-08)
    IN_DIAGNOSIS --> CANCELED: CANCEL
    QUOTE_SENT --> CANCELED: CANCEL
    APPROVED --> CANCELED: CANCEL
    REJECTED --> CANCELED: CANCEL
    IN_REPAIR --> CANCELED: CANCEL
    READY --> CANCELED: CANCEL
    DELIVERED --> [*]: terminal (garantia cria NOVA OS)
    CANCELED --> [*]: terminal
```

## Sequência da aprovação pública (ADR-005)

```mermaid
sequenceDiagram
    actor T as Técnico/Admin
    participant API as API OFIX
    actor C as Cliente (celular)
    participant W as Página pública /q/{token}

    T->>API: POST /quotes/{id}/send (SEND_QUOTE)
    API->>API: quote -> SENT, token novo, validade 7 dias (RN-03)
    T->>C: envia o link por WhatsApp/SMS
    C->>W: abre /q/{token} (sem login)
    W->>API: GET /public/quotes/{token}
    API-->>W: empresa, OS resumida, itens, total, validade
    C->>W: toca em "Aprovar orçamento"
    W->>API: POST /public/quotes/{token}/approve
    API->>API: máquina valida (RN-01) + evento actorType=CUSTOMER (RN-09)
    API-->>W: OS -> APPROVED
    Note over API: token expirado responde 410 (RN-05)
```

## Fluxo de garantia (RN-06/RN-07)

```mermaid
flowchart TD
    A[OS entregue\nDELIVER] -->|grava deliveredAt e\nwarrantyUntil = +90 dias| B[Garantia ativa]
    B -->|cliente volta com defeito\naté warrantyUntil| C{Reabrir em garantia}
    C -->|dentro do prazo| D[NOVA OS filha\nstatus RECEIVED\nprioridade mínima HIGH\nwarrantyParentId aponta para a original]
    C -->|prazo vencido| E[422 com a data limite\nabre-se OS normal, cobrável]
    D --> F[Orçamento da filha nasce com a\nmão de obra original ZERADA\npeças podem ser cobradas]
    B -->|90 dias se passam| G[Garantia encerra\nOS original permanece DELIVERED]
```
