import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import {
  ActorType,
  ItemKind,
  OrderStatus,
  Priority,
  QuoteStatus,
  Role,
  type PrismaClient,
} from '@prisma/client';
import argon2 from 'argon2';

import { fail } from './lib/cli';
import { createDb } from './lib/db';

const USAGE = `seed-demo — popula o banco com os dados de demonstração

Cria (idempotente, pode rodar mais de uma vez):
  - Tenant "TecNorte Assistência" (tecnorte) com filiais Matriz Fortaleza
    e Filial Aldeota (com coordenadas reais — alimentam o mapa público)
  - Tenant "Eletrolar Recife" (eletrolar) com 1 filial — prova o
    isolamento entre tenants
  - ~19 OS na TecNorte cobrindo TODOS os status e as 2 filiais, com datas
    espalhadas em 6 meses (curva de receita), 2 atrasadas, 1 entregue em
    garantia e 1 OS de garantia já aberta; orçamento SENT com link público
    impresso ao final (spec 011)
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


interface DemoOrderSeed {
  code: string;
  branch: string;
  customer: { name: string; phone: string; email?: string };
  equipment: { type: string; brand: string; model: string };
  issue: string;
  status: OrderStatus;
  priority?: Priority;
  technician?: boolean;
  diagnosis?: string;
  /** Months back for createdAt (fractions ok). */
  ageMonths: number;
  /** promisedAt relative to now, in days (negative = overdue). */
  promisedInDays?: number;
  /** Approved-quote total for revenue (DELIVERED) or sent/decided quotes. */
  quote?: { status: QuoteStatus; totalCents: number; partCents: number };
  warrantyChildOf?: string;
}

const MONTH_MS = 30 * 24 * 3_600_000;

/** Demo orders for TecNorte (spec 011): every status, both branches. */
const DEMO_ORDERS: DemoOrderSeed[] = [
  // DELIVERED across 6 months — shapes the revenue chart.
  { code: 'OS-DEMO-001', branch: 'Matriz Fortaleza', customer: { name: 'Maria das Dores', phone: '(85) 98811-0001' }, equipment: { type: 'Notebook', brand: 'Dell', model: 'Inspiron 15' }, issue: 'Não liga após queda de energia', status: OrderStatus.DELIVERED, technician: true, diagnosis: 'Fonte queimada; substituída por peça nova homologada.', ageMonths: 5.4, quote: { status: QuoteStatus.APPROVED, totalCents: 42000, partCents: 28000 } },
  { code: 'OS-DEMO-002', branch: 'Filial Aldeota', customer: { name: 'João Batista', phone: '(85) 98811-0002' }, equipment: { type: 'Smartphone', brand: 'Samsung', model: 'Galaxy S22' }, issue: 'Tela trincada após queda', status: OrderStatus.DELIVERED, technician: true, diagnosis: 'Display e touch danificados; módulo substituído.', ageMonths: 4.6, quote: { status: QuoteStatus.APPROVED, totalCents: 89000, partCents: 65000 } },
  { code: 'OS-DEMO-003', branch: 'Matriz Fortaleza', customer: { name: 'Ana Beatriz Lima', phone: '(85) 98811-0003', email: 'ana.lima@example.com' }, equipment: { type: 'Notebook', brand: 'Lenovo', model: 'IdeaPad 3' }, issue: 'Superaquecimento e desligamentos', status: OrderStatus.DELIVERED, technician: true, diagnosis: 'Pasta térmica ressecada e cooler obstruído; manutenção completa.', ageMonths: 3.5, quote: { status: QuoteStatus.APPROVED, totalCents: 26000, partCents: 8000 } },
  { code: 'OS-DEMO-004', branch: 'Filial Aldeota', customer: { name: 'Carlos Eduardo', phone: '(85) 98811-0004' }, equipment: { type: 'Console', brand: 'Sony', model: 'PlayStation 5' }, issue: 'HDMI sem sinal', status: OrderStatus.DELIVERED, technician: true, diagnosis: 'Porta HDMI com pinos rompidos; retrabalho de solda.', ageMonths: 2.4, quote: { status: QuoteStatus.APPROVED, totalCents: 54000, partCents: 18000 } },
  { code: 'OS-DEMO-005', branch: 'Matriz Fortaleza', customer: { name: 'Francisca Souza', phone: '(85) 98811-0005' }, equipment: { type: 'Impressora', brand: 'Epson', model: 'EcoTank L3250' }, issue: 'Não puxa papel', status: OrderStatus.DELIVERED, technician: true, diagnosis: 'Rolete de tração gasto; substituído e calibrado.', ageMonths: 1.4, quote: { status: QuoteStatus.APPROVED, totalCents: 31000, partCents: 12000 } },
  // Delivered recently => warranty still valid (reopen testable) + its child below.
  { code: 'OS-DEMO-006', branch: 'Matriz Fortaleza', customer: { name: 'Roberto Nogueira', phone: '(85) 98811-0006' }, equipment: { type: 'Notebook', brand: 'Acer', model: 'Aspire 5' }, issue: 'Teclado com teclas falhando', status: OrderStatus.DELIVERED, technician: true, diagnosis: 'Teclado com trilhas oxidadas; módulo substituído.', ageMonths: 0.5, quote: { status: QuoteStatus.APPROVED, totalCents: 38000, partCents: 22000 } },
  { code: 'OS-DEMO-007', branch: 'Matriz Fortaleza', customer: { name: 'Roberto Nogueira', phone: '(85) 98811-0006' }, equipment: { type: 'Notebook', brand: 'Acer', model: 'Aspire 5' }, issue: 'Garantia: tecla espaço voltou a falhar', status: OrderStatus.RECEIVED, priority: Priority.HIGH, ageMonths: 0.1, warrantyChildOf: 'OS-DEMO-006' },
  // Pipeline coverage.
  { code: 'OS-DEMO-008', branch: 'Filial Aldeota', customer: { name: 'Patrícia Mendes', phone: '(85) 98811-0008' }, equipment: { type: 'Smartphone', brand: 'Apple', model: 'iPhone 13' }, issue: 'Bateria descarrega em horas', status: OrderStatus.RECEIVED, ageMonths: 0.05, promisedInDays: 4 },
  { code: 'OS-DEMO-009', branch: 'Matriz Fortaleza', customer: { name: 'Luiz Henrique', phone: '(85) 98811-0009' }, equipment: { type: 'Notebook', brand: 'HP', model: 'Pavilion 14' }, issue: 'HD fazendo barulho e travando', status: OrderStatus.IN_DIAGNOSIS, technician: true, ageMonths: 0.15, promisedInDays: 3 },
  { code: 'OS-DEMO-010', branch: 'Filial Aldeota', customer: { name: 'Fernanda Castro', phone: '(85) 98811-0010' }, equipment: { type: 'Tablet', brand: 'Samsung', model: 'Tab S8' }, issue: 'Não carrega', status: OrderStatus.IN_DIAGNOSIS, technician: true, ageMonths: 0.2 },
  // QUOTE_SENT with a LIVE public token — printed for the README.
  { code: 'OS-DEMO-011', branch: 'Matriz Fortaleza', customer: { name: 'Antônio Ferreira', phone: '(85) 98811-0011' }, equipment: { type: 'Notebook', brand: 'Dell', model: 'Vostro 3520' }, issue: 'Tela com linhas verticais', status: OrderStatus.QUOTE_SENT, technician: true, diagnosis: 'Flat de vídeo com mau contato e display com dano permanente.', ageMonths: 0.25, promisedInDays: 6, quote: { status: QuoteStatus.SENT, totalCents: 73000, partCents: 55000 } },
  { code: 'OS-DEMO-012', branch: 'Filial Aldeota', customer: { name: 'Juliana Rocha', phone: '(85) 98811-0012' }, equipment: { type: 'Smartphone', brand: 'Motorola', model: 'Edge 30' }, issue: 'Câmera embaçada', status: OrderStatus.QUOTE_SENT, technician: true, diagnosis: 'Lente riscada e módulo com umidade; troca recomendada.', ageMonths: 0.3, quote: { status: QuoteStatus.SENT, totalCents: 41000, partCents: 30000 } },
  { code: 'OS-DEMO-013', branch: 'Matriz Fortaleza', customer: { name: 'Marcos Vinícius', phone: '(85) 98811-0013' }, equipment: { type: 'Console', brand: 'Microsoft', model: 'Xbox Series S' }, issue: 'Desliga sozinho em jogos', status: OrderStatus.APPROVED, technician: true, diagnosis: 'Superaquecimento por ventoinha travada.', ageMonths: 0.35, promisedInDays: 5, quote: { status: QuoteStatus.APPROVED, totalCents: 29000, partCents: 12000 } },
  { code: 'OS-DEMO-014', branch: 'Filial Aldeota', customer: { name: 'Sandra Regina', phone: '(85) 98811-0014' }, equipment: { type: 'Notebook', brand: 'Samsung', model: 'Book E30' }, issue: 'Touchpad sem resposta', status: OrderStatus.REJECTED, technician: true, diagnosis: 'Touchpad danificado; placa auxiliar precisa de troca.', ageMonths: 0.4, quote: { status: QuoteStatus.REJECTED, totalCents: 52000, partCents: 38000 } },
  // IN_REPAIR ×2 — one badly overdue (dashboard attention table).
  { code: 'OS-DEMO-URG', branch: 'Filial Aldeota', customer: { name: 'Maria Silva', phone: '(85) 98811-0015' }, equipment: { type: 'Notebook', brand: 'Dell', model: 'Inspiron 15' }, issue: 'Cliente VIP: máquina de trabalho não inicia o sistema', status: OrderStatus.IN_REPAIR, priority: Priority.URGENT, technician: true, diagnosis: 'SSD em falha iminente; clonagem e substituição em andamento.', ageMonths: 0.6, promisedInDays: -2, quote: { status: QuoteStatus.APPROVED, totalCents: 61000, partCents: 42000 } },
  { code: 'OS-DEMO-015', branch: 'Matriz Fortaleza', customer: { name: 'Paulo César', phone: '(85) 98811-0016' }, equipment: { type: 'Drone', brand: 'DJI', model: 'Mini 3' }, issue: 'Hélice quebrada e gimbal travado', status: OrderStatus.IN_REPAIR, technician: true, diagnosis: 'Conjunto de hélices e motor do gimbal substituídos.', ageMonths: 0.45, promisedInDays: 2, quote: { status: QuoteStatus.APPROVED, totalCents: 47000, partCents: 33000 } },
  // READY ×2 — one overdue pickup.
  { code: 'OS-DEMO-016', branch: 'Matriz Fortaleza', customer: { name: 'Helena Martins', phone: '(85) 98811-0017' }, equipment: { type: 'Notebook', brand: 'Apple', model: 'MacBook Air M1' }, issue: 'Teclado borboleta com teclas presas', status: OrderStatus.READY, technician: true, diagnosis: 'Limpeza profunda e troca de membranas.', ageMonths: 0.5, promisedInDays: -5, quote: { status: QuoteStatus.APPROVED, totalCents: 35000, partCents: 9000 } },
  { code: 'OS-DEMO-017', branch: 'Filial Aldeota', customer: { name: 'Ricardo Alves', phone: '(85) 98811-0018' }, equipment: { type: 'Monitor', brand: 'LG', model: 'UltraWide 29' }, issue: 'Manchas na tela', status: OrderStatus.READY, technician: true, diagnosis: 'Backlight com LED queimado; barra substituída.', ageMonths: 0.4, promisedInDays: 1, quote: { status: QuoteStatus.APPROVED, totalCents: 33000, partCents: 21000 } },
  { code: 'OS-DEMO-018', branch: 'Matriz Fortaleza', customer: { name: 'Beatriz Cunha', phone: '(85) 98811-0019' }, equipment: { type: 'Smartphone', brand: 'Xiaomi', model: 'Redmi Note 12' }, issue: 'Molhou na praia, não liga', status: OrderStatus.CANCELED, ageMonths: 0.7 },
];

const ELETROLAR_ORDERS: DemoOrderSeed[] = [
  { code: 'OS-DEMO-101', branch: 'Matriz', customer: { name: 'Severino Costa', phone: '(81) 98822-0001' }, equipment: { type: 'Micro-ondas', brand: 'Electrolux', model: 'ME41X' }, issue: 'Não aquece', status: OrderStatus.IN_DIAGNOSIS, ageMonths: 0.2 },
  { code: 'OS-DEMO-102', branch: 'Matriz', customer: { name: 'Quitéria Ramos', phone: '(81) 98822-0002' }, equipment: { type: 'Geladeira', brand: 'Brastemp', model: 'Frost Free 375' }, issue: 'Fazendo gelo no fundo', status: OrderStatus.RECEIVED, ageMonths: 0.1 },
];

interface SeededUsers {
  adminId: string;
  technicianId: string | null;
}

async function seedOrders(
  db: PrismaClient,
  tenantId: string,
  branchIds: Map<string, string>,
  users: SeededUsers,
  orders: DemoOrderSeed[],
): Promise<{ sentQuoteToken: string | null }> {
  const now = Date.now();
  let sentQuoteToken: string | null = null;
  const idsByCode = new Map<string, string>();

  for (const seed of orders) {
    const branchId = branchIds.get(seed.branch);
    if (branchId === undefined) {
      throw new Error(`seed inconsistente: filial "${seed.branch}" não existe`);
    }
    const createdAt = new Date(now - seed.ageMonths * MONTH_MS);

    let customer = await db.customer.findFirst({
      where: { tenantId, phone: seed.customer.phone },
    });
    customer ??= await db.customer.create({
      data: {
        tenantId,
        name: seed.customer.name,
        phone: seed.customer.phone,
        email: seed.customer.email ?? null,
      },
    });

    let equipment = await db.equipment.findFirst({
      where: { customerId: customer.id, model: seed.equipment.model },
    });
    equipment ??= await db.equipment.create({
      data: { tenantId, customerId: customer.id, ...seed.equipment },
    });

    const delivered = seed.status === OrderStatus.DELIVERED;
    const deliveredAt = delivered
      ? new Date(createdAt.getTime() + 9 * 24 * 3_600_000)
      : null;
    const warrantyParentId =
      seed.warrantyChildOf === undefined ? null : (idsByCode.get(seed.warrantyChildOf) ?? null);

    const order = await db.serviceOrder.upsert({
      where: { tenantId_code: { tenantId, code: seed.code } },
      update: { status: seed.status },
      create: {
        tenantId,
        branchId,
        customerId: customer.id,
        equipmentId: equipment.id,
        createdById: users.adminId,
        assignedTechnicianId: seed.technician === true ? users.technicianId : null,
        code: seed.code,
        status: seed.status,
        priority: seed.priority ?? Priority.NORMAL,
        reportedIssue: seed.issue,
        technicalDiagnosis: seed.diagnosis ?? null,
        warrantyParentId,
        createdAt,
        promisedAt:
          seed.promisedInDays === undefined
            ? null
            : new Date(now + seed.promisedInDays * 24 * 3_600_000),
        deliveredAt,
        warrantyUntil: deliveredAt
          ? new Date(deliveredAt.getTime() + 90 * 24 * 3_600_000)
          : null,
      },
    });
    idsByCode.set(seed.code, order.id);

    if (seed.quote) {
      const laborCents = seed.quote.totalCents - seed.quote.partCents;
      const quote = await db.quote.upsert({
        where: { serviceOrderId_version: { serviceOrderId: order.id, version: 1 } },
        update: {
          status: seed.quote.status,
          totalCents: seed.quote.totalCents,
          // re-seeding renews the public link validity (RN-05: 7 days)
          ...(seed.quote.status === QuoteStatus.SENT
            ? { tokenExpiresAt: new Date(now + 7 * 24 * 3_600_000) }
            : {}),
        },
        create: {
          tenantId,
          serviceOrderId: order.id,
          version: 1,
          status: seed.quote.status,
          totalCents: seed.quote.totalCents,
          tokenExpiresAt:
            seed.quote.status === QuoteStatus.SENT
              ? new Date(now + 7 * 24 * 3_600_000)
              : new Date(createdAt.getTime() + 7 * 24 * 3_600_000),
          approvedAt:
            seed.quote.status === QuoteStatus.APPROVED
              ? new Date(createdAt.getTime() + 2 * 24 * 3_600_000)
              : null,
          rejectedAt:
            seed.quote.status === QuoteStatus.REJECTED
              ? new Date(createdAt.getTime() + 2 * 24 * 3_600_000)
              : null,
          rejectionReason:
            seed.quote.status === QuoteStatus.REJECTED ? 'Valor acima do esperado.' : null,
          createdAt: new Date(createdAt.getTime() + 24 * 3_600_000),
        },
      });
      const hasItems = await db.quoteItem.findFirst({ where: { quoteId: quote.id } });
      if (hasItems === null) {
        await db.quoteItem.createMany({
          data: [
            {
              quoteId: quote.id,
              kind: ItemKind.PART,
              description: `Peça de reposição — ${seed.equipment.brand} ${seed.equipment.model}`,
              quantity: 1,
              unitPriceCents: seed.quote.partCents,
              subtotalCents: seed.quote.partCents,
            },
            {
              quoteId: quote.id,
              kind: ItemKind.LABOR,
              description: 'Mão de obra especializada',
              quantity: 1,
              unitPriceCents: laborCents,
              subtotalCents: laborCents,
            },
          ],
        });
      }
      if (seed.quote.status === QuoteStatus.SENT) {
        sentQuoteToken = quote.publicToken;
      }
    }

    const hasEvents = await db.orderEvent.findFirst({ where: { serviceOrderId: order.id } });
    if (hasEvents === null) {
      await db.orderEvent.create({
        data: {
          tenantId,
          serviceOrderId: order.id,
          actorType: ActorType.USER,
          actorId: users.adminId,
          type: 'ORDER_CREATED',
          toStatus: OrderStatus.RECEIVED,
          createdAt,
        },
      });
      if (seed.status !== OrderStatus.RECEIVED) {
        await db.orderEvent.create({
          data: {
            tenantId,
            serviceOrderId: order.id,
            actorType: ActorType.USER,
            actorId: users.technicianId ?? users.adminId,
            type: 'STATUS_CHANGED',
            fromStatus: OrderStatus.RECEIVED,
            toStatus: seed.status,
            metadata: { seeded: true },
            createdAt: new Date(createdAt.getTime() + 2 * 3_600_000),
          },
        });
      }
    }
  }

  return { sentQuoteToken };
}

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

    const admin = await db.user.findFirstOrThrow({
      where: { tenantId: tenant.id, role: Role.ADMIN },
    });
    const technician = await db.user.findFirst({
      where: { tenantId: tenant.id, role: Role.TECHNICIAN },
    });
    const { sentQuoteToken } = await seedOrders(
      db,
      tenant.id,
      branchIds,
      { adminId: admin.id, technicianId: technician?.id ?? null },
      tenantSeed.slug === 'tecnorte' ? DEMO_ORDERS : ELETROLAR_ORDERS,
    );

    console.log(`Tenant "${tenant.name}" (${tenant.slug}) pronto.`);
    console.log(`  Mapa público: /m/${tenant.publicMapToken}`);
    if (sentQuoteToken !== null) {
      console.log(`  Orçamento público (aprovável sem login): /q/${sentQuoteToken}`);
    }
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
