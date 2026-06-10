import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  pageMeta,
  type CreateUserBody,
  type ListUsersQuery,
  type UpdateUserBody,
} from '@ofix/shared';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

import { pageArgs } from '../../common/pagination';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TENANT_INJECTED } from '../../infra/prisma/tenant.extension';
import { ARGON2_OPTIONS } from '../auth/auth.service';

/** Never expose passwordHash. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  branchId: true,
  isActive: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQuery) {
    const where: Prisma.UserWhereInput =
      query.search === undefined
        ? {}
        : {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          };
    const [data, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { name: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.client.user.count({ where }),
    ]);
    return { data, meta: pageMeta(query, total) };
  }

  async create(body: CreateUserBody) {
    await this.assertBranchValid(body.branchId ?? null);
    const existing = await this.prisma.client.user.findFirst({ where: { email: body.email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado neste tenant');
    }
    const passwordHash = await argon2.hash(body.password, ARGON2_OPTIONS);
    return this.prisma.client.user.create({
      data: {
        tenantId: TENANT_INJECTED,
        name: body.name,
        email: body.email,
        role: body.role,
        branchId: body.branchId ?? null,
        passwordHash,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, body: UpdateUserBody) {
    const user = await this.prisma.client.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    if (body.branchId !== undefined) {
      await this.assertBranchValid(body.branchId);
    }
    return this.prisma.client.user.update({
      where: { id },
      data: body,
      select: USER_SELECT,
    });
  }

  private async assertBranchValid(branchId: string | null): Promise<void> {
    if (branchId === null) {
      return; // null = access to every branch of the tenant
    }
    const branch = await this.prisma.client.branch.findUnique({ where: { id: branchId } });
    if (!branch?.isActive) {
      throw new UnprocessableEntityException('Filial inválida ou inativa');
    }
  }
}
