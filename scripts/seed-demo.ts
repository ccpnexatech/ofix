import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { Role, type PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

import { fail } from './lib/cli';
import { createDb } from './lib/db';

const USAGE = `seed-demo — popula o banco com os dados de demonstração

Cria (idempotente, pode rodar mais de uma vez):
  - Tenant "TecNorte Assistência" (tecnorte) com filiais Matriz Fortaleza
    e Filial Aldeota (com coordenadas reais — alimentam o mapa público)
  - Tenant "Eletrolar Recife" (eletrolar) com 1 filial — prova o
    isolamento entre tenants
  - Usuários de demonstração (senha padrão: "ofix-demo-123"):
      admin@tecnorte.dev     ADMIN      todas as filiais
      tecnico@tecnorte.dev   TECHNICIAN Matriz Fortaleza
      atendente@tecnorte.dev ATTENDANT  Filial Aldeota
      admin@eletrolar.dev    ADMIN      todas as filiais

Ordens de serviço e orçamentos de demonstração serão adicionados quando o
domínio existir (spec 011, Fase 12).

Uso:
  tsx scripts/seed-demo.ts          (ou: pnpm db:seed)
  tsx scripts/seed-demo.ts --help`;

export const DEMO_PASSWORD = 'ofix-demo-123';

interface BranchSeed {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string;
  longitude: string;
}

interface UserSeed {
  name: string;
  email: string;
  role: Role;
  /** Branch name within the tenant; undefined = access to all branches. */
  branch?: string;
}

interface TenantSeed {
  name: string;
  slug: string;
  document: string;
  branches: BranchSeed[];
  users: UserSeed[];
}

const TENANTS: TenantSeed[] = [
  {
    name: 'TecNorte Assistência',
    slug: 'tecnorte',
    document: '12.345.678/0001-90',
    branches: [
      {
        name: 'Matriz Fortaleza',
        phone: '(85) 3222-1000',
        address: 'Av. Bezerra de Menezes, 100 — São Gerardo',
        city: 'Fortaleza',
        state: 'CE',
        zipCode: '60325-002',
        latitude: '-3.731862',
        longitude: '-38.526670',
      },
      {
        name: 'Filial Aldeota',
        phone: '(85) 3222-2000',
        address: 'Av. Santos Dumont, 1500 — Aldeota',
        city: 'Fortaleza',
        state: 'CE',
        zipCode: '60150-160',
        latitude: '-3.732700',
        longitude: '-38.496700',
      },
    ],
    users: [
      { name: 'Ana Souza', email: 'admin@tecnorte.dev', role: Role.ADMIN },
      {
        name: 'Carlos Lima',
        email: 'tecnico@tecnorte.dev',
        role: Role.TECHNICIAN,
        branch: 'Matriz Fortaleza',
      },
      {
        name: 'Beatriz Ramos',
        email: 'atendente@tecnorte.dev',
        role: Role.ATTENDANT,
        branch: 'Filial Aldeota',
      },
    ],
  },
  {
    name: 'Eletrolar Recife',
    slug: 'eletrolar',
    document: '98.765.432/0001-10',
    branches: [
      {
        name: 'Matriz',
        phone: '(81) 3333-4000',
        address: 'Rua da Aurora, 500 — Boa Vista',
        city: 'Recife',
        state: 'PE',
        zipCode: '50050-000',
        latitude: '-8.059616',
        longitude: '-34.881028',
      },
    ],
    users: [{ name: 'Diego Andrade', email: 'admin@eletrolar.dev', role: Role.ADMIN }],
  },
];

export async function seedDemo(db: PrismaClient): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  for (const tenantSeed of TENANTS) {
    const tenant = await db.tenant.upsert({
      where: { slug: tenantSeed.slug },
      update: { name: tenantSeed.name, document: tenantSeed.document },
      create: {
        name: tenantSeed.name,
        slug: tenantSeed.slug,
        document: tenantSeed.document,
      },
    });

    const branchIds = new Map<string, string>();
    for (const branchSeed of tenantSeed.branches) {
      const { name, ...rest } = branchSeed;
      const branch = await db.branch.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        update: rest,
        create: { tenantId: tenant.id, name, ...rest },
      });
      branchIds.set(name, branch.id);
    }

    for (const userSeed of tenantSeed.users) {
      const branchId = userSeed.branch === undefined ? null : branchIds.get(userSeed.branch);
      if (branchId === undefined) {
        throw new Error(`seed inconsistente: filial "${userSeed.branch ?? ''}" não existe`);
      }
      await db.user.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: userSeed.email } },
        update: { name: userSeed.name, role: userSeed.role, branchId },
        create: {
          tenantId: tenant.id,
          branchId,
          name: userSeed.name,
          email: userSeed.email,
          role: userSeed.role,
          passwordHash,
        },
      });
    }

    console.log(`Tenant "${tenant.name}" (${tenant.slug}) pronto.`);
    console.log(`  Mapa público: /m/${tenant.publicMapToken}`);
    for (const user of tenantSeed.users) {
      console.log(`  ${user.role.padEnd(10)} ${user.email}  (filial: ${user.branch ?? 'todas'})`);
    }
  }

  console.log(`\nSenha padrão de demonstração: ${DEMO_PASSWORD}`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { help: { type: 'boolean', default: false } },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  const db = createDb();
  try {
    await seedDemo(db);
  } finally {
    await db.$disconnect();
  }
}

// Only run as a CLI entrypoint; reset-db.ts imports seedDemo directly.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
