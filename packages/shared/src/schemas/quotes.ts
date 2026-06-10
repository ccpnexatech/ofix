import { z } from 'zod';

import { ItemKind, QuoteStatus } from '../enums';

export const quoteItemInputSchema = z.object({
  kind: z.enum(ItemKind),
  description: z.string().trim().min(2, 'Descrição muito curta'),
  quantity: z.number().int().min(1, 'Quantidade mínima é 1'),
  // >= 0: warranty labor items are legitimately zero (RN-07). Total > 0 is
  // enforced at SEND_QUOTE (RN-03).
  unitPriceCents: z.number().int().min(0, 'Preço não pode ser negativo'),
});
// The inferred type matches QuoteItemInput from quote-totals.ts (canonical).

/** PATCH /quotes/:id — batch replace of the items while DRAFT (spec 005). */
export const updateQuoteItemsBodySchema = z.object({
  items: z.array(quoteItemInputSchema).max(50, 'Máximo de 50 itens'),
});
export type UpdateQuoteItemsBody = z.infer<typeof updateQuoteItemsBodySchema>;

export const publicRejectBodySchema = z.object({
  reason: z.string().trim().min(5, 'Informe o motivo da recusa (mínimo 5 caracteres)'),
});
export type PublicRejectBody = z.infer<typeof publicRejectBodySchema>;

/** GET /public/quotes/:token — only what the customer needs to decide (ADR-005). */
export const publicQuoteResponseSchema = z.object({
  company: z.object({
    name: z.string(),
    branch: z.object({
      name: z.string(),
      city: z.string(),
      state: z.string(),
      phone: z.string().nullable(),
    }),
  }),
  order: z.object({
    code: z.string(),
    equipment: z.string(),
    reportedIssue: z.string(),
  }),
  quote: z.object({
    version: z.number().int(),
    status: z.enum(QuoteStatus),
    items: z.array(
      z.object({
        kind: z.enum(ItemKind),
        description: z.string(),
        quantity: z.number().int(),
        unitPriceCents: z.number().int(),
        subtotalCents: z.number().int(),
      }),
    ),
    totalCents: z.number().int(),
    tokenExpiresAt: z.iso.datetime().nullable(),
    decidedAt: z.iso.datetime().nullable(),
    rejectionReason: z.string().nullable(),
  }),
});
export type PublicQuoteResponse = z.infer<typeof publicQuoteResponseSchema>;
