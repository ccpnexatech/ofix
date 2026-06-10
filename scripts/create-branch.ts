import { parseArgs } from 'node:util';

import { askOptional, askRequired, closePrompts, fail } from './lib/cli';
import { createDb } from './lib/db';
import { validCoordinate, validState } from './lib/validate';

const USAGE = `create-branch — adiciona uma filial a um tenant existente

Uso:
  tsx scripts/create-branch.ts [flags]   (sem flags = modo interativo)

Flags:
  --tenant      Slug do tenant (ex.: tecnorte)
  --name        Nome da filial (ex.: "Filial Aldeota")
  --phone       Telefone (opcional)
  --address     Endereço completo
  --city        Cidade
  --state       UF (2 letras)
  --zip         CEP (opcional)
  --lat / --lng Coordenadas para o mapa público (opcional — sem elas a
                filial não aparece no mapa; valores negativos exigem a
                forma --lat=-3.73)
  --help        Esta ajuda

Exemplo:
  tsx scripts/create-branch.ts --tenant tecnorte --name "Filial Aldeota" \\
    --address "Av. Santos Dumont, 1500" --city Fortaleza --state CE \\
    --lat=-3.732700 --lng=-38.496700

Idempotência: se a filial (tenant + nome) já existir, nada é alterado.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      tenant: { type: 'string' },
      name: { type: 'string' },
      phone: { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      zip: { type: 'string' },
      lat: { type: 'string' },
      lng: { type: 'string' },
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

    const name = await askRequired('Nome da filial', values.name);
    const existing = await db.branch.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name } },
    });
    if (existing) {
      console.log(`\nFilial "${name}" já existe no tenant "${slug}". Nada foi alterado.`);
      return;
    }

    const phone = await askOptional('Telefone', values.phone);
    const address = await askRequired('Endereço', values.address);
    const city = await askRequired('Cidade', values.city);
    const state = validState(await askRequired('UF', values.state));
    const zipCode = await askOptional('CEP', values.zip);
    const latitude = validCoordinate('latitude', await askOptional('Latitude', values.lat));
    const longitude = validCoordinate('longitude', await askOptional('Longitude', values.lng));

    if (latitude === undefined || longitude === undefined) {
      console.log('\nAviso: sem latitude/longitude a filial NÃO aparecerá no mapa público.');
    }

    const branch = await db.branch.create({
      data: {
        tenantId: tenant.id,
        name,
        phone,
        address,
        city,
        state,
        zipCode,
        latitude,
        longitude,
      },
    });

    console.log('\nFilial criada com sucesso!');
    console.log(`  Tenant: ${tenant.name} (${slug})`);
    console.log(`  Filial: ${branch.name} — ${city}/${state} (id ${branch.id})`);
  } finally {
    closePrompts();
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
