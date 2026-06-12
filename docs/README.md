# Documentação do OFIX

Mapa de toda a documentação do projeto. Comece pelo que você é:

## Para quem USA o sistema

- **[Guia de uso](user-guide.md)** — o manual completo, da chegada do aparelho
  à garantia, com telas reais. Inclui FAQ e glossário.

## Para quem OPERA a plataforma

- **[Scripts operacionais](scripts.md)** — criar tenant/filial/usuário,
  rotacionar o link do mapa, seed e reset (com saídas reais).
- **[Setup local e deploy](setup.md)** — rodar em 5 comandos; Neon + Render + Vercel passo a passo.

## Para quem DESENVOLVE

- **[Specs](../specs/000-master.md)** — a fonte de verdade do que foi
  construído, fase a fase (comece pelo master).
- **[ADRs](adr/)** — as decisões de arquitetura, numeradas em ordem cronológica, com
  contexto e trade-offs.
- **[Regras de negócio](business-rules.md)** — RN-01..RN-15 com a máquina de
  estados e a matriz de permissões.
- **[Fluxos](flows.md)** — diagramas Mermaid dos três fluxos centrais.
- **[Assistente Fia](assistant.md)** — arquitetura, system prompt, tools e limites.
- **[Referência da API](api-reference.md)** — todos os endpoints com curl e
  respostas reais.
- **[Banco de dados](database.md)** — ERD, dicionário de dados,
  relacionamentos e índices justificados.
- **[Design system](design-system.md)** — tokens, temas, componentes e a rota
  `/design`.

## Para a Fia (assistente de IA)

O contexto que a assistente lê é gerado de `user-guide.md`,
`business-rules.md` e `flows.md` por `pnpm assistant:context` — se você editar
qualquer um deles, rode o comando e commite o resultado (o CI confere).
