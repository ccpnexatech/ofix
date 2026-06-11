import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * WCAG AA contrast audit of the REAL tokens (spec 007 DoD): parses
 * globals.css, extracts both theme blocks and asserts every text/surface
 * pair. Normal text needs 4.5:1; large text/icons 3:1.
 */

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

function themeBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `theme block ${selector} not found`).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf('}', css.indexOf('--', start) + 1) + 1);
  // blocks contain nested vars only; capture every --name: #hex
  const body = css.slice(start, css.indexOf('\n}', start));
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    const name = match[1];
    const hex = match[2];
    if (name !== undefined && hex !== undefined) {
      vars[name] = hex;
    }
  }
  expect(Object.keys(vars).length, `no tokens parsed for ${selector} (${String(block.length)})`).toBeGreaterThan(10);
  return vars;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

const STATUSES = [
  'received',
  'in-diagnosis',
  'quote-sent',
  'approved',
  'rejected',
  'in-repair',
  'ready',
  'delivered',
  'canceled',
];

describe.each([
  ['light', ':root'],
  ['dark', "[data-theme='dark']"],
])('AA contrast — %s theme', (_label, selector) => {
  const tokens = themeBlock(selector);

  const textSurfacePairs: [string, string, number][] = [
    // [foreground, background, minimum ratio]
    ['text', 'surface', 4.5],
    ['text', 'surface-raised', 4.5],
    ['text', 'surface-sunken', 4.5],
    ['text-muted', 'surface', 4.5],
    ['text-muted', 'surface-raised', 4.5],
    ['text-faint', 'surface', 4.5],
    ['text-faint', 'surface-raised', 4.5],
    ['success', 'success-bg', 4.5],
    ['warning', 'warning-bg', 4.5],
    ['danger', 'danger-bg', 4.5],
    ['info', 'info-bg', 4.5],
    ...STATUSES.map(
      (status): [string, string, number] => [`status-${status}`, `status-${status}-bg`, 4.5],
    ),
  ];

  it.each(textSurfacePairs)('%s on %s >= %s:1', (fg, bg, minimum) => {
    const fgHex = tokens[fg];
    const bgHex = tokens[bg];
    expect(fgHex, `missing token --${fg}`).toBeDefined();
    expect(bgHex, `missing token --${bg}`).toBeDefined();
    const ratio = fgHex !== undefined && bgHex !== undefined ? contrast(fgHex, bgHex) : 0;
    expect(
      ratio,
      `--${fg} (${String(fgHex)}) on --${bg} (${String(bgHex)}) = ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(minimum);
  });
});
