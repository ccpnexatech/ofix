import { randomBytes } from 'node:crypto';
import { stdin, stdout } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';

let rl: Interface | undefined;

// Typed boolean, but undefined at runtime when stdin is not a terminal;
// the falsy check below handles both.
const interactive = stdin.isTTY;

function prompts(): Interface {
  rl ??= createInterface({ input: stdin, output: stdout });
  return rl;
}

/** Must be called before the script exits, otherwise stdin keeps it alive. */
export function closePrompts(): void {
  rl?.close();
  rl = undefined;
}

/** Returns the flag value when given; otherwise prompts until non-empty. */
export async function askRequired(label: string, current: string | undefined): Promise<string> {
  if (current !== undefined && current.trim() !== '') {
    return current.trim();
  }
  if (!interactive) {
    fail(`valor obrigatório ausente: ${label}. Sem terminal interativo, use as flags (--help).`);
  }
  for (;;) {
    const answer = (await prompts().question(`${label}: `)).trim();
    if (answer !== '') {
      return answer;
    }
    console.log('Valor obrigatório.');
  }
}

/** Returns the flag value when given; otherwise prompts once (empty = skip). */
export async function askOptional(
  label: string,
  current: string | undefined,
): Promise<string | undefined> {
  if (current !== undefined && current.trim() !== '') {
    return current.trim();
  }
  if (!interactive) {
    return undefined;
  }
  const answer = (await prompts().question(`${label} (Enter para pular): `)).trim();
  return answer === '' ? undefined : answer;
}

/** y/N confirmation; `assumeYes` (--yes) skips the prompt. */
export async function confirm(question: string, assumeYes: boolean): Promise<boolean> {
  if (assumeYes) {
    return true;
  }
  if (!interactive) {
    fail('confirmação necessária. Sem terminal interativo, use --yes.');
  }
  const answer = (await prompts().question(`${question} [y/N] `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes' || answer === 's' || answer === 'sim';
}

export function generatePassword(): string {
  return randomBytes(9).toString('base64url');
}

export function fail(message: string): never {
  console.error(`\nErro: ${message}`);
  closePrompts();
  process.exit(1);
}
