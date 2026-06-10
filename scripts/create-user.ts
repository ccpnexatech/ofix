import { parseArgs } from 'node:util';

import { Role } from '@prisma/client';
import argon2 from 'argon2';

import { askOptional, askRequired, closePrompts, fail, generatePassword } from './lib/cli';
import { createDb } from './lib/db';
import { validEmail } from './lib/validate';

const ROLES = Object.values(Role).join(' | ');

const USAGE = `create-user — cria um usuário num tenant existente

Uso:
  tsx scripts/create-user.ts [flags]   (sem flags = modo interativo)

Flags:
  --tenant    Slug do tenant (ex.: tecnorte)
  --name      Nome do usuário
  --email     E-mail (único por tenant)
  --role      ${ROLES}
  --branch    Nome da filial de escopo (opcional; ausente = todas as filiais)
  --password  Senha (opcional; gerada se ausente)
  --help      Esta ajuda

Exemplo:
  tsx scripts/create-user.ts --tenant tecnorte --name "Carlos Lima" \\
    --email carlos@tecnorte.dev --role TECHNICIAN --branch Matriz

Idempotência: se o e-mail já existir no tenant, nada é alterado.`;

function validRole(value: string): Role {
  const normalized = value.toUpperCase();
  if (!(normalized in Role)) {
    fail(`role inválida: "${value}" (use ${ROLES})`);
  }
  return normalized as Role;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      tenant: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string' },
      branch: { type: 'string' },
      password: { type: 'string' },
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
      fail(`tenant "${slug}" não encontrado. Crie com: tsx scripts/create-tenant.ts`);
    }

    const email = validEmail(await askRequired('E-mail', values.email));
    const existing = await db.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (existing) {
      console.log(`\nUsuário "${email}" já existe no tenant "${slug}". Nada foi alterado.`);
      return;
    }

    const name = await askRequired('Nome', values.name);
    const role = validRole(await askRequired(`Role (${ROLES})`, values.role));
    const branchName = await askOptional('Filial de escopo (vazio = todas)', values.branch);

    let branchId: string | undefined;
    if (branchName !== undefined) {
      const branch = await db.branch.findUnique({
        where: { tenantId_name: { tenantId: tenant.id, name: branchName } },
      });
      if (!branch) {
        fail(`filial "${branchName}" não existe no tenant "${slug}"`);
      }
      branchId = branch.id;
    }

    const password = values.password ?? generatePassword();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await db.user.create({
      data: { tenantId: tenant.id, branchId, name, email, passwordHash, role },
    });

    console.log('\nUsuário criado com sucesso!');
    console.log(`  Tenant: ${tenant.name} (${slug})`);
    console.log(`  Nome:   ${name}`);
    console.log(`  E-mail: ${email}`);
    console.log(`  Role:   ${role}`);
    console.log(`  Filial: ${branchName ?? 'todas as filiais'}`);
    console.log(`  Senha:  ${password}  (troque após o primeiro login)`);
  } finally {
    closePrompts();
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
