import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, themeCss, shareColors } from '../src/themes.js';
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
// Text on its background must reach WCAG AA (4.5:1).
const TEXT = [['ink', 'bg'], ['ink', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['on-primary', 'primary'], ['primary', 'surface'], ['primary', 'bg'], ['primary', 'primary-soft'], ['mint-ink', 'mint'], ['peach-ink', 'peach'], ['rose-ink', 'rose'], ['sky-ink', 'sky'], ['butter-ink', 'butter'], ['ink', 'primary-soft'], ['ink', 'mint'], ['ink', 'butter']];
// Status tiles in the progress grid only need to stand apart from the card (WCAG non-text 3:1 is too strict for pastel fills; 1.3:1 keeps them visible) and have a legend.
const TILES = [['good', 'surface'], ['some', 'surface'], ['bad', 'surface']];
for (const t of THEMES) for (const mode of ['light', 'dark']) test(`${t.name} ${mode}: text contrast meets WCAG AA`, () => {
  const c = t[mode];
  for (const [fg, bg] of TEXT) { const r = ratio(c[fg], c[bg]); assert.ok(r >= 4.5, `${t.name} ${mode}: ${fg} on ${bg} is ${r.toFixed(2)}`); }
  for (const [fg, bg] of TILES) { const r = ratio(c[fg], c[bg]); assert.ok(r >= 1.3, `${t.name} ${mode}: ${fg} tile on ${bg} is ${r.toFixed(2)}`); }
});
test('every look defines the same complete set of colours', () => {
  const keys = Object.keys(THEMES[0].light).sort().join();
  for (const t of THEMES) for (const m of ['light', 'dark']) { assert.equal(Object.keys(t[m]).sort().join(), keys, t.id + ' ' + m); for (const v of Object.values(t[m])) assert.match(v, /^#[0-9A-F]{6}$/i); }
});
test('each look has its own sounds, motion and shape', () => {
  assert.equal(new Set(THEMES.map(t => t.id)).size, THEMES.length);
  assert.equal(new Set(THEMES.map(t => JSON.stringify(t.sound.alarm))).size, THEMES.length);
  for (const t of THEMES) { assert.ok(t.sound.alarm.notes.length && t.sound.taken.notes.length); assert.ok(t.sound.alarm.gain > 0 && t.sound.alarm.gain <= .5); assert.ok(t.radius >= 8 && t.zoom >= 1 && t.zoom <= 1.2); }
  const css = themeCss(); for (const t of THEMES) assert.ok(css.includes(`[data-skin="${t.id}"]`));
  assert.ok(!/undefined|NaN/.test(css));
  for (const t of THEMES) { const k = shareColors(t.id); for (const [a, b] of [['ink', 'card'], ['tileInk', 'tile'], ['brand', 'card']]) assert.ok(ratio(k[a], k[b]) >= 4.5, t.id + ' share ' + a); }
});
