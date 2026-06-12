import { describe, expect, it } from 'vitest';

import { createBranchBodySchema, updateBranchBodySchema } from './branches';

const VALID = {
  name: 'Filial Aldeota',
  address: 'Av. Santos Dumont, 1500',
  city: 'Fortaleza',
  state: 'ce',
};

describe('createBranchBodySchema (ADR-013)', () => {
  it('accepts the minimum payload, normalizes UF and defaults optionals to null', () => {
    const parsed = createBranchBodySchema.parse(VALID);
    expect(parsed.state).toBe('CE');
    expect(parsed.phone).toBeNull();
    expect(parsed.zipCode).toBeNull();
    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  it("treats '' from form inputs as null — never as coordinate 0", () => {
    const parsed = createBranchBodySchema.parse({
      ...VALID,
      phone: '',
      zipCode: ' ',
      latitude: '',
      longitude: '',
    });
    expect(parsed.phone).toBeNull();
    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  it('coerces numeric strings from the form and keeps numbers as-is', () => {
    const parsed = createBranchBodySchema.parse({
      ...VALID,
      latitude: '-3.7327',
      longitude: -38.4967,
    });
    expect(parsed.latitude).toBeCloseTo(-3.7327);
    expect(parsed.longitude).toBeCloseTo(-38.4967);
  });

  it('rejects out-of-range coordinates, non-numeric input and invalid UF', () => {
    expect(createBranchBodySchema.safeParse({ ...VALID, latitude: 91 }).success).toBe(false);
    expect(createBranchBodySchema.safeParse({ ...VALID, longitude: -181 }).success).toBe(false);
    expect(createBranchBodySchema.safeParse({ ...VALID, latitude: 'abc' }).success).toBe(false);
    expect(createBranchBodySchema.safeParse({ ...VALID, state: 'Ceará' }).success).toBe(false);
  });
});

describe('updateBranchBodySchema (ADR-013)', () => {
  it('accepts a partial payload and rejects an empty one', () => {
    expect(updateBranchBodySchema.parse({ name: 'Nova Matriz' })).toEqual({ name: 'Nova Matriz' });
    expect(updateBranchBodySchema.safeParse({}).success).toBe(false);
  });

  it('allows clearing coordinates with null', () => {
    expect(updateBranchBodySchema.parse({ latitude: null, longitude: null })).toEqual({
      latitude: null,
      longitude: null,
    });
  });
});
