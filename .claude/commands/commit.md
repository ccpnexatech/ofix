# /commit — Commits pequenos por contexto

1. Rode `git status` e `git diff` (staged e unstaged) para ver tudo que mudou.
2. Agrupe as mudanças por unidade lógica (um assunto = um commit). Nunca misture contextos (ex.: feature + config de tooling no mesmo commit).
3. Para cada grupo, na ordem que conta a história:
   - `git add` apenas dos arquivos do grupo (use `git add -p` se um arquivo mistura contextos).
   - Commit em inglês no padrão Conventional Commits com escopo: `feat|fix|test|docs|refactor|chore|ci` + `(api|web|shared|db|specs)`.
   - Mensagem no imperativo, descrevendo o quê e, se não-óbvio, o porquê no corpo.
4. Ao final, mostre `git log --oneline` dos commits criados.

Nunca use `git push --force` na main. Não faça push a menos que solicitado.
