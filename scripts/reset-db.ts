import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { closePrompts, confirm, fail } from './lib/cli';
import { createDb } from './lib/db';
import { loadDatabaseEnv } from './lib/env';
import { seedDemo } from './seed-demo';

const USAGE = `reset-db — APAGA o banco de desenvolvimento e recria do zero

Executa: drop de todas as tabelas -> migrations -> seed de demonstração.
Aborta se NODE_ENV=production. Apenas para desenvolvimento local.

Uso:
  tsx scripts/reset-db.ts [flags]

Flags:
  --yes   Não pedir confirmação
  --help  Esta ajuda`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV=production — reset-db é apenas para desenvolvimento.');
  }

  loadDatabaseEnv();
  const url = process.env.DATABASE_URL ?? '(não definida)';
  const proceed = await confirm(
    `Isso APAGA TODOS os dados de ${url} e recria o schema. Continuar?`,
    values.yes,
  );
  closePrompts();
  if (!proceed) {
    console.log('Operação cancelada. Nada foi alterado.');
    return;
  }

  console.log('\nResetando o banco (prisma migrate reset)...');
  execSync('pnpm exec prisma migrate reset --force --skip-seed', {
    cwd: join(import.meta.dirname, '..', 'apps', 'api'),
    env: { ...process.env, DISABLE_ERD: 'true' },
    stdio: 'inherit',
  });

  console.log('\nPopulando com dados de demonstração...');
  const db = createDb();
  try {
    await seedDemo(db);
  } finally {
    await db.$disconnect();
  }
  console.log('\nBanco recriado com sucesso.');
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
