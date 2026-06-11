import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

/**
 * Builds the product context the Fia assistant reads (spec 010): the user
 * guide, the business rules and the flows, concatenated into a committed
 * file. `--check` fails when the generated file is stale vs. the docs — the
 * CI runs it so the assistant never answers from outdated documentation.
 */

const ROOT = join(import.meta.dirname, '..');
const SOURCES = ['docs/user-guide.md', 'docs/business-rules.md', 'docs/flows.md'];
const TARGET = 'apps/api/src/modules/assistant/context.generated.md';

const HEADER = `<!--
  GERADO por \`pnpm assistant:context\` — NÃO edite à mão.
  Fontes: ${SOURCES.join(' · ')}
  Após editar qualquer fonte, rode o comando e commite este arquivo.
-->

`;

function build(): string {
  const parts = SOURCES.map((source) => {
    const content = readFileSync(join(ROOT, source), 'utf8').trim();
    return `<!-- fonte: ${source} -->\n\n${content}`;
  });
  return HEADER + parts.join('\n\n---\n\n') + '\n';
}

function main(): void {
  const { values } = parseArgs({
    options: {
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(
      'assistant:context — gera o contexto da Fia a partir dos docs\n' +
        'Uso: tsx scripts/build-assistant-context.ts [--check]',
    );
    return;
  }

  const expected = build();
  const targetPath = join(ROOT, TARGET);

  if (values.check) {
    let current = '';
    try {
      current = readFileSync(targetPath, 'utf8');
    } catch {
      // missing file = stale
    }
    if (current !== expected) {
      console.error(
        `Contexto da Fia desatualizado: rode \`pnpm assistant:context\` e commite ${TARGET}`,
      );
      process.exit(1);
    }
    console.log('Contexto da Fia em dia.');
    return;
  }

  writeFileSync(targetPath, expected);
  console.log(`Contexto gerado em ${TARGET} (${String(expected.length)} chars)`);
}

main();
