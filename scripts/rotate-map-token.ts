import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

import { askRequired, closePrompts, confirm, fail } from './lib/cli';
import { createDb } from './lib/db';

const USAGE = `rotate-map-token — rotaciona o token do mapa público de um tenant

O link antigo do mapa (/m/{token}) deixa de funcionar imediatamente.

Uso:
  tsx scripts/rotate-map-token.ts [flags]   (sem flags = modo interativo)

Flags:
  --tenant  Slug do tenant (ex.: tecnorte)
  --yes     Não pedir confirmação
  --help    Esta ajuda

Exemplo:
  tsx scripts/rotate-map-token.ts --tenant tecnorte --yes`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      tenant: { type: 'string' },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  const db = createDb();
  try {
    const slug = await askRequired('Slug do tenant', values.tenant);
    const tenant = await db.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      fail(`tenant "${slug}" não encontrado`);
    }

    const proceed = await confirm(
      `Rotacionar o token do mapa de "${tenant.name}"? O link atual (/m/${tenant.publicMapToken}) será revogado.`,
      values.yes,
    );
    if (!proceed) {
      console.log('Operação cancelada. Nada foi alterado.');
      return;
    }

    const updated = await db.tenant.update({
      where: { id: tenant.id },
      data: { publicMapToken: randomUUID() },
    });

    console.log('\nToken rotacionado com sucesso!');
    console.log(`  Novo link do mapa: /m/${updated.publicMapToken}`);
  } finally {
    closePrompts();
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
