# /fase — Retomar a fase atual

Execute o ritual de sessão do projeto OFIX:

1. Leia `CLAUDE.md` e `specs/000-master.md`. A fase atual é a primeira desmarcada no checklist de fases.
2. Leia integralmente a(s) spec(s) que governam a fase atual.
3. Verifique o estado real do código vs. o Definition of Done da spec: liste o que já está feito e o que falta.
4. Apresente um plano curto com as tarefas restantes (pequenas, commitáveis individualmente).
5. Execute tarefa a tarefa: implementar → testar → commitar (Conventional Commits, escopo correto, em inglês).
6. Ao concluir todos os itens, rode `/checar-dod` antes de declarar a fase encerrada.

Nunca avance para a próxima fase com item aberto. Ideias fora da spec vão para `docs/backlog.md`.
