import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicMapResponse } from '@ofix/shared';

import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * RN-15: the shareable map exposes ONLY active branches with coordinates —
 * name, address, phone, city. Never orders, customers or users. The token is
 * rotatable via scripts/rotate-map-token.ts (the old link dies instantly).
 */
@Injectable()
export class PublicMapService {
  constructor(private readonly prisma: PrismaService) {}

  async view(mapToken: string): Promise<PublicMapResponse> {
    // Unscoped by necessity: the token IS the credential (ADR-005 pattern).
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { publicMapToken: mapToken },
      select: {
        isActive: true,
        name: true,
        branches: {
          where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
          orderBy: { name: 'asc' },
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    if (!tenant?.isActive) {
      throw new NotFoundException('Mapa não encontrado');
    }
    return {
      tenantName: tenant.name,
      branches: tenant.branches.map((branch) => ({
        name: branch.name,
        address: branch.address,
        city: branch.city,
        state: branch.state,
        phone: branch.phone,
        lat: Number(branch.latitude),
        lng: Number(branch.longitude),
      })),
    };
  }
}
