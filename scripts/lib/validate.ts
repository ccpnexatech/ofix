import { fail } from './cli';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Deliberately loose: scripts are an operator tool, not a public form.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validSlug(value: string): string {
  if (!SLUG_PATTERN.test(value)) {
    fail(`slug inválido: "${value}" (use letras minúsculas, números e hífens, ex.: tecnorte)`);
  }
  return value;
}

export function validEmail(value: string): string {
  const normalized = value.toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    fail(`e-mail inválido: "${value}"`);
  }
  return normalized;
}

export function validState(value: string): string {
  const normalized = value.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    fail(`UF inválida: "${value}" (use a sigla de 2 letras, ex.: CE)`);
  }
  return normalized;
}

/** Validates a latitude/longitude flag; returns the string Prisma Decimal accepts. */
export function validCoordinate(
  kind: 'latitude' | 'longitude',
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const numeric = Number(value);
  const limit = kind === 'latitude' ? 90 : 180;
  if (Number.isNaN(numeric) || Math.abs(numeric) > limit) {
    fail(`${kind} inválida: "${value}"`);
  }
  return value;
}
