import { parseArgs } from 'node:util';

import { Role } from '@prisma/client';
import argon2 from 'argon2';

import { askOptional, askRequired, closePrompts, fail, generatePassword } from './lib/cli';
import { createDb } from './lib/db';
import { validCoordinate, validEmail, validSlug, validState } from './lib/validate';

const USAGE = `create-tenant — cria tenant + filial Matriz + usuário ADMIN inicial

Uso:
  tsx scripts/create-tenant.ts [flags]   (sem flags = modo interativo)

Flags:
  --name           Nome da empresa (ex.: "TecNorte Assistência")
  --slug           Slug único para URLs (ex.: tecnorte)
  --document       CNPJ (opcional)
  --branch-name    Nome da primeira filial (padrão: Matriz)
  --address        Endereço completo da filial
  --city           Cidade
  --state          UF (2 letras)
  --zip            CEP (opcional)
  --lat / --lng    Coordenadas para o mapa público (opcional; valores
                   negativos exigem a forma --lat=-3.73)
  --admin-name     Nome do usuário ADMIN
  --admin-email    E-mail do ADMIN
  --admin-password Senha do ADMIN (opcional; gerada se ausente)
  --help           Esta ajuda

Exemplo:
  tsx scripts/create-tenant.ts --name "TecNorte Assistência" --slug tecnorte \\
    --address "Av. Bezerra de Menezes, 100" --city Fortaleza --state CE \\
    --lat=-3.731862 --lng=-38.526670 \\
    --admin-name "Ana Souza" --admin-email ana@tecnorte.dev

Idempotência: se o slug já existir, nada é alterado e o tenant é apenas exibido.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      slug: { type: 'string' },
      document: { type: 'string' },
      'branch-name': { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      zip: { type: 'string' },
      lat: { type: 'string' },
      lng: { type: 'string' },
      'admin-name': { type: 'string' },
      'admin-email': { type: 'string' },
      'admin-password': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  const db = createDb();
  try {
    const name = await askRequired('Nome da empresa', values.name);
    const slug = validSlug(await askRequired('Slug (URLs, ex.: tecnorte)', values.slug));

    const existing = await db.tenant.findUnique({ where: { slug } });
    if (existing) {
      console.log(`\nTenant "${slug}" já existe (id ${existing.id}). Nada foi alterado.`);
      console.log(`Token do mapa público: ${existing.publicMapToken}`);
      return;
    }

    const document = await askOptional('CNPJ', values.document);
    const branchName = values['branch-name'] ?? 'Matriz';
    const address = await askRequired('Endereço da filial', values.address);
    const city = await askRequired('Cidade', values.city);
    const state = validState(await askRequired('UF', values.state));
    const zipCode = await askOptional('CEP', values.zip);
    const latitude = validCoordinate('latitude', await askOptional('Latitude', values.lat));
    const longitude = validCoordinate('longitude', await askOptional('Longitude', values.lng));
    const adminName = await askRequired('Nome do ADMIN', values['admin-name']);
    const adminEmail = validEmail(await askRequired('E-mail do ADMIN', values['admin-email']));
    const password = values['admin-password'] ?? generatePassword();

    if (latitude === undefined || longitude === undefined) {
      console.log('\nAviso: sem latitude/longitude a filial NÃO aparecerá no mapa público.');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const tenant = await db.tenant.create({
      data: {
        name,
        slug,
        document,
        branches: {
          create: { name: branchName, address, city, state, zipCode, latitude, longitude },
        },
        users: {
          create: { name: adminName, email: adminEmail, passwordHash, role: Role.ADMIN },
        },
      },
    });

    console.log('\nTenant criado com sucesso!');
    console.log(`  Tenant:  ${tenant.name} (slug ${tenant.slug}, id ${tenant.id})`);
    console.log(`  Filial:  ${branchName} — ${city}/${state}`);
    console.log(`  ADMIN:   ${adminEmail}`);
    console.log(`  Senha:   ${password}  (troque após o primeiro login)`);
    console.log(`  Mapa:    /m/${tenant.publicMapToken}`);
  } finally {
    closePrompts();
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
