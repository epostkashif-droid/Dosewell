import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const block = re => Object.fromEntries([...css.match(re)[1].matchAll(/--([a-z-]+):(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const light = block(/:root\{([^}]+)\}/), dark = block(/:root\[data-theme="dark"\]\{([^}]+)\}/);
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const PAIRS = [['ink', 'bg'], ['ink', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['on-primary', 'primary'], ['primary', 'surface'], ['primary', 'primary-soft'], ['mint-ink', 'mint'], ['peach-ink', 'peach'], ['rose-ink', 'rose'], ['sky-ink', 'sky'], ['butter-ink', 'butter']];
for (const [name, t] of [['light', light], ['dark', dark]]) test(`text contrast meets WCAG AA (4.5:1) in the ${name} theme`, () => {
  for (const [fg, bg] of PAIRS) { const r = ratio(t[fg], t[bg]); assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}`); }
});
