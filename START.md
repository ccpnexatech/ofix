# START — Bootstrap do Projeto OFIX

> Este é o arquivo a ser executado na PRIMEIRA sessão do Claude Code dentro da pasta `OFIX/`.
> Prompt sugerido: `Leia START.md e execute o bootstrap.`

## Sequência obrigatória

1. **Ler `CLAUDE.md` integralmente.** Ele define as regras invioláveis do projeto.
2. **Ler `specs/000-master.md` integralmente.** Ele orquestra todas as fases.
3. **Ler TODAS as specs (001 a 012) antes de escrever qualquer linha de código.** Resumir em 1 parágrafo por spec para confirmar entendimento com o Caio.
4. Confirmar pré-requisitos no ambiente:
   - `node -v` (>= 22), `pnpm -v` (>= 9), `docker -v`, `gh auth status`.
   - Se algo faltar, listar e parar até resolver.
5. Perguntar ao Caio (bloqueantes):
   - Repositório público ou privado?
   - Nome de usuário GitHub para o `gh repo create`.
6. Iniciar a **Fase 0** conforme `specs/000-master.md`:
   - `git init` + primeiro commit (`chore: add project specs and claude config`) contendo specs, CLAUDE.md, .claude/ e este arquivo.
   - `gh repo create` e push.
   - Montar o monorepo (spec 001), CI verde, e fechar a fase pelo ritual de DoD.

## Ritual de toda sessão (incluindo as futuras)

1. Ler `CLAUDE.md` + `specs/000-master.md` → identificar fase atual.
2. Listar as tarefas restantes da fase em um plano curto.
3. Executar tarefa a tarefa: implementar → testar → commitar (pequeno, por contexto).
4. Ao concluir a fase: rodar gates (`typecheck`, `lint`, `test`), marcar checklist da spec, atualizar o `000-master.md`, abrir PR com `gh pr create`, merge.
5. Nunca avançar de fase com item aberto.

## Comandos personalizados disponíveis

- `/fase` — retoma a fase atual e executa o ritual acima.
- `/checar-dod` — roda todos os gates e audita o checklist da fase.
- `/commit` — analisa o diff e cria commits pequenos separados por contexto.
