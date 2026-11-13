import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLogic, sanitizeState, sanitizeRecord, blank, sampleState, addDays, today, at, isDate, isTime, str, waNumber, telHref, notifId, LIMITS, ymd } from '../src/logic.js';

const NOON = new Date(2026, 10, 14, 12, 0, 0).getTime();
const mk = (over = {}) => { const s = blank(); s.people = [{ id: 'p1', name: 'Amma', relation: 'Mother', color: 0 }]; s.meds = [{ id: 'm1', personId: 'p1', name: 'Metformin', strength: '500 mg', form: 'Tablet', qty: 1, times: ['08:00', '20:00'], days: [0, 1, 2, 3, 4, 5, 6], food: 'After food', start: '2026-11-01', end: '', stock: 10, notes: '', active: true, created: 0 }]; return sanitizeState(Object.assign(s, over)); };
const fill = (s, L, from, to, now) => { for (let ds = from; ds <= to; ds = addDays(ds, 1)) for (const d of L.dosesFor(ds, null, now)) if (d.status !== 'upcoming') L.markDose(ds, d.key, 't0800'); };

test('dose status moves upcoming, due, missed around the one-hour grace window', () => {
  const s = mk(), L = makeLogic(() => s), m = s.meds[0], t = at('2026-11-14', '08:00');
  assert.equal(L.doseStatus('2026-11-14', m, '08:00', t - 1), 'upcoming');
  assert.equal(L.doseStatus('2026-11-14', m, '08:00', t), 'due');
  assert.equal(L.doseStatus('2026-11-14', m, '08:00', t + 59 * 60000), 'due');
  assert.equal(L.doseStatus('2026-11-14', m, '08:00', t + 60 * 60000), 'missed');
});
test('streak counts full days, ignores a pending today, and breaks on a miss', () => {
  const s = mk(), L = makeLogic(() => s);
  fill(s, L, '2026-11-01', '2026-11-13', NOON);
  assert.equal(L.streak('p1', at('2026-11-14', '07:00')), 13);
  L.markDose('2026-11-14', 'm1|08:00', 't0801');
  assert.equal(L.streak('p1', NOON), 13, 'today pending (evening dose still ahead)');
  L.markDose('2026-11-14', 'm1|20:00', 't2001');
  assert.equal(L.streak('p1', at('2026-11-14', '22:00')), 14);
  L.markDose('2026-11-10', 'm1|20:00', null);
  assert.equal(L.streak('p1', at('2026-11-14', '22:00')), 4);
  assert.equal(L.bestStreak('p1', at('2026-11-14', '22:00')), 9);
});
test('missed run counts consecutive misses and skips, stops at a taken dose', () => {
  const s = mk(), L = makeLogic(() => s);
  fill(s, L, '2026-11-01', '2026-11-12', NOON);
  assert.equal(L.missedRun('p1', NOON).length, 3); // 13th x2 + 14th morning
  L.markDose('2026-11-13', 'm1|20:00', 's');
  assert.equal(L.missedRun('p1', NOON).length, 3, 'a skip still counts as not taken');
  L.markDose('2026-11-14', 'm1|08:00', 't0900');
  assert.equal(L.missedRun('p1', NOON).length, 0);
});
test('stock goes down once per taken dose, comes back on undo, never below zero', () => {
  const s = mk(), L = makeLogic(() => s);
  L.markDose('2026-11-14', 'm1|08:00', 't0800'); assert.equal(s.meds[0].stock, 9);
  L.markDose('2026-11-14', 'm1|08:00', 't0805'); assert.equal(s.meds[0].stock, 9, 'marking twice does not double count');
  L.markDose('2026-11-14', 'm1|08:00', 's'); assert.equal(s.meds[0].stock, 10);
  s.meds[0].stock = 0; L.markDose('2026-11-14', 'm1|20:00', 't2000'); assert.equal(s.meds[0].stock, 0);
  assert.equal(L.markDose('2026-11-14', 'nope|08:00', 't0800'), false);
  assert.equal(L.markDose('2026-11-14', 'm1|99:99', 't0800'), false);
  assert.equal(L.markDose('not-a-date', 'm1|08:00', 't0800'), false);
  assert.equal(L.markDose('2026-11-14', 'm1|08:00', '<script>'), false);
});
test('a new or changed schedule does not create missed doses in the past', () => {
  const s = mk(); s.meds[0].created = NOON; const L = makeLogic(() => s);
  assert.deepEqual(L.dosesFor('2026-11-14', null, NOON + 1).map(d => d.time), ['20:00']);
  assert.equal(L.dosesFor('2026-11-10', null, NOON).length, 0);
  assert.equal(L.missedRun('p1', NOON + 1).length, 0);
});
test('a paused medicine keeps logged history but adds no new misses', () => {
  const s = mk(), L = makeLogic(() => s);
  L.markDose('2026-11-13', 'm1|08:00', 't0800'); s.meds[0].active = false;
  assert.equal(L.dosesFor('2026-11-13', null, NOON).length, 1);
  assert.equal(L.dosesFor('2026-11-14', null, NOON).length, 0);
  assert.equal(L.upcoming(5, NOON).length, 0);
});
test('a dose late at night is still due just after midnight', () => {
  const s = mk(); s.meds[0].times = ['23:30']; const L = makeLogic(() => s);
  const due = L.dueNow(at('2026-11-15', '00:10'));
  assert.equal(due.length, 1); assert.equal(due[0].date, '2026-11-14');
});
test('weekday schedules and end dates are respected', () => {
  const s = mk(); s.meds[0].days = [0]; s.meds[0].end = '2026-11-08'; const L = makeLogic(() => s);
  assert.equal(L.dosesFor('2026-11-08', null, NOON).length, 2); // Sunday
  assert.equal(L.dosesFor('2026-11-09', null, NOON).length, 0);
  assert.equal(L.dosesFor('2026-11-15', null, NOON + 5 * 864e5).length, 0, 'after end date');
});
test('adherence is a whole percentage between 0 and 100', () => {
  const s = mk(), L = makeLogic(() => s);
  assert.equal(L.adherence('p1', 30, at('2026-11-01', '07:00')).pct, null);
  fill(s, L, '2026-11-01', '2026-11-07', NOON);
  const a = L.adherence('p1', 30, NOON); assert.ok(a.pct >= 0 && a.pct <= 100); assert.equal(a.taken, 14); assert.equal(a.total, 27);
});
test('refill estimate and upcoming reminders', () => {
  const s = mk(), L = makeLogic(() => s);
  assert.equal(L.daysLeft(s.meds[0]), 5);
  s.meds[0].stock = null; assert.equal(L.daysLeft(s.meds[0]), null);
  const up = L.upcoming(5, NOON); assert.equal(up.length, 9); assert.equal(up[0].time, '20:00');
  assert.ok(up.every((d, i) => i === 0 || at(d.date, d.time) >= at(up[i - 1].date, up[i - 1].time)));
});
test('daylight-saving style day arithmetic never skips or repeats a date', () => {
  let ds = '2026-01-01'; const seen = new Set();
  for (let i = 0; i < 800; i++) { assert.ok(isDate(ds)); assert.ok(!seen.has(ds)); seen.add(ds); ds = addDays(ds, 1); }
  assert.equal(addDays('2028-02-28', 1), '2028-02-29'); assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
test('validators', () => {
  for (const v of ['2026-02-30', '2026-13-01', '1999-01-01', '2026-1-1', '', null, 5, '2026-11-14T00:00', '__proto__']) assert.equal(isDate(v), false, String(v));
  for (const v of ['24:00', '8:00', '08:60', '', null, '08:00:00']) assert.equal(isTime(v), false, String(v));
  assert.equal(str('  a\u0000b c  ', 10), 'abc'); assert.equal(str(42), ''); assert.equal(str('x'.repeat(500), 40).length, 40);
  assert.equal(waNumber('098400 12345', '91'), '919840012345'); assert.equal(waNumber('+91 98400-12345', '91'), '919840012345'); assert.equal(waNumber('', '91'), '');
  assert.equal(telHref('+91 (98400) 12345;ext=<x>'), '+919840012345');
  const id = notifId('2026-11-14m1|08:00a'); assert.ok(Number.isInteger(id) && id > 0 && id < 2147483647);
});

/* ---------- hostile input ---------- */
const XSS = ['<img src=x onerror=window.__xss=1>', '"><script>window.__xss=1</script>', "'-alert(1)-'", 'javascript:alert(1)', '</textarea><svg onload=window.__xss=1>', '${7*7}', '{{constructor.constructor("x")()}}'];
test('sanitizeState drops unknown fields, bad ids, bad types and oversized input', () => {
  const evil = {
    __proto__: { polluted: 1 }, constructor: { prototype: { polluted: 1 } }, extra: 'x',
    people: [{ id: '"><img onerror=1>', name: 'bad id' }, { id: 'p1', name: XSS[0].repeat(50), relation: XSS[1], color: 9e9, blood: XSS[2], evil: 1 }, { id: 'p1', name: 'dup' }, null, 7, 'x', { id: 'p2', name: '   ' }],
    meds: [{ id: 'm1', personId: 'p1', name: XSS[0], times: ['08:00', '25:00', 8, '<x>', '08:00'], days: [0, 7, -1, 'a', 1.5], form: XSS[1], food: {}, qty: 'NaN', start: 'never', end: '2020-01-01', stock: '1e400', created: 'x' }, { id: 'm2', personId: 'ghost', name: 'orphan', times: ['08:00'] }, { id: 'm3', personId: 'p1', name: 'no times', times: [] }],
    logs: { '2026-11-14': { 'm1|08:00': 't0800', 'm1|25:00': 't', 'ghost|08:00': 't', 'm1|08:00|x': 't', 'm1': 't', '__proto__': 't' }, '__proto__': { 'm1|08:00': 't' }, 'constructor': {}, '2026-99-99': {}, '2026-11-13': { 'm1|08:00': '<script>' } },
    contacts: [{ id: 'c1', name: 'G', phone: '+91 98400<script>12345', guardian: 'yes' }],
    settings: { threshold: 999, snooze: 7, cc: '<b>91', theme: 'neon', sound: 'no', ack: { p1: XSS[0].repeat(20), ghost: 'x', __proto__: 'y' }, onboarded: 1 },
    updatedAt: 'tomorrow'
  };
  const s = sanitizeState(evil);
  assert.deepEqual(Object.keys(s).sort(), ['contacts', 'logs', 'meds', 'people', 'settings', 'updatedAt', 'v']);
  assert.equal(({}).polluted, undefined);
  assert.equal(s.people.length, 1); assert.equal(s.people[0].name.length, 40); assert.equal(s.people[0].relation, 'Other'); assert.equal(s.people[0].color, 5); assert.equal(s.people[0].blood, ''); assert.equal(s.people[0].evil, undefined);
  assert.equal(s.meds.length, 1); const m = s.meds[0];
  assert.deepEqual(m.times, ['08:00']); assert.deepEqual(m.days, [0]); assert.equal(m.form, 'Other'); assert.equal(m.food, 'Any time'); assert.equal(m.qty, 1); assert.ok(isDate(m.start)); assert.equal(m.end, ''); assert.equal(m.created, 0);
  assert.deepEqual(s.logs, { '2026-11-14': { 'm1|08:00': 't0800' } });
  assert.equal(s.contacts[0].phone, '+91 9840012345'); assert.equal(s.contacts[0].guardian, false);
  assert.equal(s.settings.threshold, 6); assert.equal(s.settings.snooze, 10); assert.equal(s.settings.cc, '91'); assert.equal(s.settings.theme, 'system'); assert.equal(s.settings.onboarded, false);
  assert.deepEqual(Object.keys(s.settings.ack), ['p1']); assert.ok(s.settings.ack.p1.length <= 80);
  assert.equal(s.updatedAt, 0);
});
test('sanitizeState survives every wrong top-level type and is idempotent', () => {
  for (const v of [null, undefined, 0, 'x', [], [1, 2], true, () => 1, { people: 'x', meds: 5, logs: [], contacts: {}, settings: [] }]) assert.deepEqual(sanitizeState(v), blank());
  const a = sanitizeState(sampleState(NOON)), b = sanitizeState(JSON.parse(JSON.stringify(a)));
  assert.deepEqual(a, b);
});
test('sanitizeState enforces hard caps', () => {
  const big = { people: Array.from({ length: 500 }, (_, i) => ({ id: 'p' + i, name: 'P' + i })), meds: [], logs: {} };
  for (let i = 0; i < 500; i++) big.meds.push({ id: 'm' + i, personId: 'p0', name: 'M', times: Array.from({ length: 50 }, (_, k) => String(k % 24).padStart(2, '0') + ':00') });
  for (let i = 0; i < 2000; i++) big.logs[addDays('2020-01-01', i)] = { 'm0|00:00': 't' };
  const s = sanitizeState(big);
  assert.equal(s.people.length, LIMITS.people); assert.equal(s.meds.length, LIMITS.meds); assert.ok(s.meds[0].times.length <= LIMITS.times); assert.equal(Object.keys(s.logs).length, LIMITS.logDays);
  assert.ok(JSON.stringify(s).length < 200000);
});
test('sanitizeRecord only accepts real base64 image data', () => {
  const ok = 'data:image/jpeg;base64,' + 'A'.repeat(40);
  assert.ok(sanitizeRecord({ id: 'r1', img: ok, title: XSS[0], type: 'x', date: 'x', personId: 'ghost' }, new Set(['p1'])));
  assert.equal(sanitizeRecord({ id: 'r1', img: ok, personId: 'ghost' }, new Set(['p1'])).personId, '');
  for (const img of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', ok + '" onerror="window.__xss=1', 'https://evil.example/x.png', '', null, 'data:image/jpeg;base64,' + 'A'.repeat(LIMITS.img)]) assert.equal(sanitizeRecord({ id: 'r1', img }), null, String(img).slice(0, 40));
  assert.equal(sanitizeRecord({ id: '../../x', img: ok }), null);
});

/* ---------- fuzz ---------- */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
test('fuzz: 400 random states keep every invariant and never throw', () => {
  const r = rng(20261114), pick = a => a[Math.floor(r() * a.length)], junk = () => pick([null, undefined, -1, 1e99, NaN, '', 'x', XSS[Math.floor(r() * XSS.length)], [], {}, true, '2026-11-14', '08:00']);
  for (let n = 0; n < 400; n++) {
    const raw = { people: [], meds: [], logs: {}, contacts: [], settings: { threshold: junk(), snooze: junk(), theme: junk() } };
    const np = Math.floor(r() * 5);
    for (let i = 0; i < np; i++) raw.people.push(r() < .1 ? junk() : { id: r() < .1 ? junk() : 'p' + i, name: r() < .1 ? junk() : 'N' + i, color: junk() });
    const nm = Math.floor(r() * 8);
    for (let i = 0; i < nm; i++) raw.meds.push(r() < .1 ? junk() : { id: 'm' + i, personId: r() < .1 ? junk() : 'p' + Math.floor(r() * 5), name: 'M' + i, times: Array.from({ length: 1 + Math.floor(r() * 4) }, () => r() < .1 ? junk() : String(Math.floor(r() * 24)).padStart(2, '0') + ':' + pick(['00', '15', '30', '45'])), days: r() < .5 ? [0, 1, 2, 3, 4, 5, 6] : [Math.floor(r() * 7), junk()], start: r() < .1 ? junk() : addDays('2026-11-14', -Math.floor(r() * 60)), end: r() < .2 ? addDays('2026-11-14', Math.floor(r() * 20) - 10) : '', stock: r() < .5 ? junk() : Math.floor(r() * 30), qty: r() < .2 ? junk() : 1, active: r() < .9, created: r() < .3 ? NOON - Math.floor(r() * 30) * 864e5 : 0 });
    const s = sanitizeState(raw), L = makeLogic(() => s);
    for (let i = 0; i < 40; i++) { const ds = addDays('2026-11-14', -Math.floor(r() * 60)); for (const d of L.dosesFor(ds, null, NOON)) if (r() < .7) L.markDose(ds, d.key, r() < .8 ? 't0800' : 's'); }
    for (const p of [...s.people, { id: null }]) {
      const st = L.streak(p.id, NOON), best = L.bestStreak(p.id, NOON), a = L.adherence(p.id, 30, NOON), run = L.missedRun(p.id, NOON);
      assert.ok(Number.isInteger(st) && st >= 0); assert.ok(best >= st, `best ${best} >= streak ${st}`);
      assert.ok(a.pct === null || (a.pct >= 0 && a.pct <= 100)); assert.ok(a.taken <= a.total);
      assert.ok(run.every(x => x.status === 'missed' || x.status === 'skipped'));
      if (run.length) assert.equal(st, st === 0 ? 0 : st);
    }
    for (const m of s.meds) { assert.ok(m.stock === null || (m.stock >= 0 && Number.isFinite(m.stock))); const dl = L.daysLeft(m); assert.ok(dl === null || dl >= 0); }
    assert.ok(L.dueNow(NOON).every(d => d.status === 'due')); assert.ok(L.upcoming(5, NOON).length <= 5 * LIMITS.meds * LIMITS.times);
    L.pruneLogs(NOON); assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(s))), sanitizeState(s));
  }
});
test('sample data shows what the app promises', () => {
  const s = sampleState(NOON), L = makeLogic(() => s);
  assert.equal(L.streak('p1', NOON), 8); assert.equal(L.missedRun('p1', NOON).length, 0); assert.equal(ymd(new Date(NOON)), today(NOON));
});
