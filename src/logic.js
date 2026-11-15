import { THEME_IDS } from './themes.js';
// Dosewell core logic: pure functions, no DOM. Shared by the app and the test suite.
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const fromYmd = s => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c); };
export const addDays = (s, n) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const today = (now = Date.now()) => ymd(new Date(now));
export const fmtTime = t => { let [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + pad(m) + ' ' + ap; };
export const at = (ds, t) => { const d = fromYmd(ds); const [h, m] = t.split(':').map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const niceDate = ds => { const d = fromYmd(ds); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; };
export const GRACE = 60 * 60000;
export const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Drops', 'Injection', 'Inhaler', 'Ointment', 'Other'];
export const FOODS = ['Before food', 'After food', 'With food', 'Any time'];
export const RELATIONS = ['Self', 'Mother', 'Father', 'Spouse', 'Son', 'Daughter', 'Grandparent', 'Other'];
export const BLOODS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const REC_TYPES = ['Prescription', 'Lab report', 'Scan', 'Bill', 'Other'];
export const LIMITS = { people: 12, meds: 60, times: 12, contacts: 12, logDays: 400, records: 300, img: 400000 };

const ID = /^[A-Za-z0-9_-]{1,24}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOG = /^(s|t(([01]\d|2[0-3])[0-5]\d)?)$/;
const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export const isId = v => typeof v === 'string' && ID.test(v);
export const isTime = v => typeof v === 'string' && TIME.test(v);
export function isDate(v) {
  if (typeof v !== 'string' || !DATE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
// Strip control characters and cap length. Everything a person types passes through here.
const CTRL = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u2028\\u2029]', 'g');
export const str = (v, max = 80) => typeof v === 'string' ? v.replace(CTRL, '').trim().slice(0, max) : '';
const num = (v, lo, hi, dflt) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const oneOf = (v, list, dflt) => list.includes(v) ? v : dflt;
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const arr = v => Array.isArray(v) ? v : [];

export function blank() {
  return {
    v: 1, people: [], meds: [], logs: {}, contacts: [],
    settings: { sound: true, threshold: 3, snooze: 10, cc: '91', ack: {}, followUp: true, discreet: false, theme: 'system', skin: 'lilac', onboarded: false },
    updatedAt: 0
  };
}

// Rebuild a state object from untrusted input (a backup file, storage, another device).
// Unknown fields are dropped; every value is type-checked, range-checked and length-capped.
export function sanitizeState(raw) {
  const r = obj(raw), s = blank();
  const seen = new Set();
  for (const p of arr(r.people).slice(0, LIMITS.people)) {
    const q = obj(p);
    if (!isId(q.id) || seen.has(q.id) || !str(q.name, 40)) continue;
    seen.add(q.id);
    s.people.push({
      id: q.id, name: str(q.name, 40), relation: oneOf(q.relation, RELATIONS, 'Other'), color: Math.floor(num(q.color, 0, 5, 0)),
      blood: oneOf(q.blood, BLOODS, ''), allergies: str(q.allergies, 160), conditions: str(q.conditions, 160),
      doctor: str(q.doctor, 60), doctorPhone: str(q.doctorPhone, 24)
    });
  }
  const medIds = new Set();
  for (const m of arr(r.meds).slice(0, LIMITS.meds)) {
    const q = obj(m);
    if (!isId(q.id) || medIds.has(q.id) || !seen.has(q.personId) || !str(q.name, 60)) continue;
    const times = [...new Set(arr(q.times).filter(isTime))].sort().slice(0, LIMITS.times);
    if (!times.length) continue;
    let days = [...new Set(arr(q.days).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    if (!days.length) days = [0, 1, 2, 3, 4, 5, 6];
    const start = isDate(q.start) ? q.start : today();
    const end = isDate(q.end) && q.end >= start ? q.end : '';
    medIds.add(q.id);
    s.meds.push({
      id: q.id, personId: q.personId, name: str(q.name, 60), strength: str(q.strength, 30), form: oneOf(q.form, FORMS, 'Other'),
      qty: num(q.qty, 0.25, 99, 1), times, days, food: oneOf(q.food, FOODS, 'Any time'), start, end,
      stock: q.stock === null || q.stock === undefined || q.stock === '' ? null : num(q.stock, 0, 99999, null),
      notes: str(q.notes, 160), active: q.active !== false, created: num(q.created, 0, 4e12, 0)
    });
  }
  const days = Object.keys(obj(r.logs)).filter(isDate).sort().slice(-LIMITS.logDays);
  for (const ds of days) {
    const src = obj(r.logs[ds]), out = {};
    let n = 0;
    for (const k of Object.keys(src)) {
      if (n >= LIMITS.meds * LIMITS.times) break;
      const i = k.indexOf('|');
      if (i < 1) continue;
      const mid = k.slice(0, i), t = k.slice(i + 1);
      if (!medIds.has(mid) || !isTime(t) || typeof src[k] !== 'string' || !LOG.test(src[k])) continue;
      out[mid + '|' + t] = src[k]; n++;
    }
    if (n) s.logs[ds] = out;
  }
  const cids = new Set();
  for (const c of arr(r.contacts).slice(0, LIMITS.contacts)) {
    const q = obj(c);
    if (!isId(q.id) || cids.has(q.id) || !str(q.name, 40)) continue;
    cids.add(q.id);
    s.contacts.push({ id: q.id, name: str(q.name, 40), relation: str(q.relation, 30), phone: str(q.phone, 24).replace(/[^\d+\-() ]/g, ''), guardian: q.guardian === true });
  }
  const st = obj(r.settings);
  s.settings.sound = st.sound !== false;
  s.settings.threshold = Math.round(num(st.threshold, 2, 6, 3));
  s.settings.snooze = oneOf(Number(st.snooze), [5, 10, 15, 30], 10);
  s.settings.cc = str(String(st.cc ?? '91'), 8).replace(/\D/g, '').slice(0, 4);
  s.settings.followUp = st.followUp !== false;
  s.settings.discreet = st.discreet === true;
  s.settings.theme = oneOf(st.theme, ['system', 'light', 'dark'], 'system');
  s.settings.skin = oneOf(st.skin, THEME_IDS, 'lilac');
  s.settings.onboarded = st.onboarded === true;
  const ack = obj(st.ack);
  for (const k of Object.keys(ack)) if (seen.has(k) && typeof ack[k] === 'string') s.settings.ack[k] = str(ack[k], 80);
  s.updatedAt = num(r.updatedAt, 0, 4e12, 0);
  if (r.sample === true) s.sample = true;
  return s;
}

export function sanitizeRecord(raw, personIds) {
  const q = obj(raw);
  if (!isId(q.id) || typeof q.img !== 'string' || q.img.length > LIMITS.img || !IMG.test(q.img)) return null;
  return {
    id: q.id, title: str(q.title, 80) || 'Untitled', type: oneOf(q.type, REC_TYPES, 'Other'),
    date: isDate(q.date) ? q.date : today(), personId: isId(q.personId) && (!personIds || personIds.has(q.personId)) ? q.personId : '',
    note: str(q.note, 300), img: q.img, createdAt: num(q.createdAt, 0, 4e12, 0)
  };
}

export function makeLogic(getState) {
  const S = () => getState();
  function scheduledOn(m, ds) { return ds >= m.start && (!m.end || ds <= m.end) && m.days.includes(fromYmd(ds).getDay()); }
  function doseStatus(ds, m, t, now) {
    const l = (S().logs[ds] || {})[m.id + '|' + t];
    if (l) return l[0] === 't' ? 'taken' : 'skipped';
    const a = at(ds, t);
    return now < a ? 'upcoming' : now < a + GRACE ? 'due' : 'missed';
  }
  // Doses for one day. Paused medicines keep the doses that were logged; unlogged doses from
  // before the schedule was created or last changed are not counted against anyone.
  function dosesFor(ds, pid, now = Date.now()) {
    const out = [], st = S();
    for (const m of st.meds) {
      if (pid && m.personId !== pid) continue;
      if (!scheduledOn(m, ds)) continue;
      for (const t of m.times) {
        const key = m.id + '|' + t, log = (st.logs[ds] || {})[key];
        if (!log && (m.active === false || at(ds, t) < (m.created || 0))) continue;
        out.push({ med: m, time: t, date: ds, key, log, status: doseStatus(ds, m, t, now) });
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name));
  }
  function dayStatus(ds, pid, now = Date.now()) {
    const d = dosesFor(ds, pid, now);
    if (!d.length) return 'empty';
    const bad = d.some(x => x.status === 'missed' || x.status === 'skipped');
    const tk = d.filter(x => x.status === 'taken').length;
    if (bad) return tk ? 'partial' : 'none';
    return tk === d.length ? 'full' : 'pending';
  }
  function firstStart(pid) { let f = null; for (const m of S().meds) if ((!pid || m.personId === pid) && (!f || m.start < f)) f = m.start; return f; }
  function streak(pid, now = Date.now()) {
    let ds = today(now), n = 0; const f = firstStart(pid);
    if (!f) return 0;
    const s0 = dayStatus(ds, pid, now);
    if (s0 === 'full') n = 1; else if (s0 === 'partial' || s0 === 'none') return 0;
    for (let i = 0; i < 400; i++) {
      ds = addDays(ds, -1);
      if (ds < f) break;
      const s = dayStatus(ds, pid, now);
      if (s === 'full') n++; else if (s !== 'empty') break;
    }
    return n;
  }
  function bestStreak(pid, now = Date.now()) {
    const f = firstStart(pid); if (!f) return 0;
    const end = today(now); let ds = addDays(end, -LIMITS.logDays); if (f > ds) ds = f;
    let run = 0, best = 0;
    while (ds <= end) {
      const s = dayStatus(ds, pid, now);
      if (s === 'full') { run++; best = Math.max(best, run); } else if (s === 'partial' || s === 'none') run = 0;
      ds = addDays(ds, 1);
    }
    return best;
  }
  function adherence(pid, days = 30, now = Date.now(), medId) {
    let taken = 0, total = 0, ds = today(now);
    for (let i = 0; i < days; i++) {
      for (const d of dosesFor(ds, pid, now)) {
        if (medId && d.med.id !== medId) continue;
        if (d.status === 'taken') { taken++; total++; } else if (d.status === 'missed' || d.status === 'skipped') total++;
      }
      ds = addDays(ds, -1);
    }
    return { taken, total, pct: total ? Math.round(taken / total * 100) : null };
  }
  // Doses missed or skipped in a row, newest first, stopping at the last one taken.
  function missedRun(pid, now = Date.now()) {
    const out = []; let ds = today(now);
    for (let i = 0; i < 14; i++) {
      const d = dosesFor(ds, pid, now).reverse();
      for (const x of d) {
        if (x.status === 'upcoming' || x.status === 'due') continue;
        if (x.status === 'taken') return out;
        out.push(x);
      }
      ds = addDays(ds, -1);
    }
    return out;
  }
  function markDose(ds, key, val) {
    const st = S();
    if (!isDate(ds) || typeof key !== 'string') return false;
    const i = key.indexOf('|'), m = st.meds.find(x => x.id === key.slice(0, i));
    if (!m || !isTime(key.slice(i + 1)) || (val && !LOG.test(val))) return false;
    const day = st.logs[ds] || (st.logs[ds] = {});
    const prev = day[key], was = !!prev && prev[0] === 't', is = !!val && val[0] === 't';
    if (typeof m.stock === 'number') {
      if (is && !was) m.stock = Math.max(0, m.stock - (m.qty || 1));
      if (was && !is) m.stock += (m.qty || 1);
    }
    if (val) day[key] = val; else { delete day[key]; if (!Object.keys(day).length) delete st.logs[ds]; }
    return true;
  }
  function daysLeft(m) {
    if (typeof m.stock !== 'number') return null;
    const perWeek = m.times.length * m.days.length * (m.qty || 1);
    return perWeek ? Math.floor(m.stock / (perWeek / 7)) : null;
  }
  function pruneLogs(now = Date.now()) { const cut = addDays(today(now), -LIMITS.logDays), st = S(); for (const k of Object.keys(st.logs)) if (k < cut) delete st.logs[k]; }
  // Doses in the grace window, including one that started before midnight.
  function dueNow(now = Date.now()) {
    const t = today(now);
    return [...dosesFor(addDays(t, -1), null, now), ...dosesFor(t, null, now)].filter(d => d.status === 'due');
  }
  // Upcoming doses for the next few days, used to schedule phone notifications.
  function upcoming(days = 5, now = Date.now()) {
    const out = []; let ds = today(now);
    for (let i = 0; i < days; i++) { for (const d of dosesFor(ds, null, now)) if (d.status === 'upcoming') out.push(d); ds = addDays(ds, 1); }
    return out.sort((a, b) => at(a.date, a.time) - at(b.date, b.time));
  }
  return { scheduledOn, doseStatus, dosesFor, dayStatus, firstStart, streak, bestStreak, adherence, missedRun, markDose, daysLeft, pruneLogs, dueNow, upcoming };
}

export function sampleState(now = Date.now()) {
  const t = today(now), s = blank(); s.sample = true; s.settings.onboarded = true;
  s.people = [
    { id: 'p1', name: 'Amma', relation: 'Mother', color: 0, blood: 'B+', allergies: 'Penicillin', conditions: 'Type 2 diabetes, high blood pressure', doctor: 'Dr. Example', doctorPhone: '00000 00000' },
    { id: 'p2', name: 'Me', relation: 'Self', color: 3, blood: '', allergies: '', conditions: '', doctor: '', doctorPhone: '' },
    { id: 'p3', name: 'Zoya', relation: 'Daughter', color: 2, blood: '', allergies: '', conditions: '', doctor: '', doctorPhone: '' }];
  const all = [0, 1, 2, 3, 4, 5, 6], st = addDays(t, -20);
  const med = (id, personId, name, strength, form, times, days, food, start, end, stock, notes) => ({ id, personId, name, strength, form, qty: 1, times, days, food, start, end, stock, notes, active: true, created: 0 });
  s.meds = [
    med('m1', 'p1', 'Metformin', '500 mg', 'Tablet', ['08:00', '20:00'], all, 'After food', st, '', 14, ''),
    med('m2', 'p1', 'Amlodipine', '5 mg', 'Tablet', ['09:00'], all, 'Any time', st, '', 22, ''),
    med('m3', 'p2', 'Vitamin D3', '60,000 IU', 'Capsule', ['10:00'], [0], 'After food', st, '', null, 'Once a week'),
    med('m4', 'p3', 'Amoxicillin syrup', '5 ml', 'Syrup', ['08:00', '14:00', '20:00'], all, 'After food', addDays(t, -3), addDays(t, 3), null, 'Finish the full course')];
  s.contacts = [{ id: 'c1', name: 'Imran', relation: 'Brother', phone: '00000 00000', guardian: true }];
  const L = makeLogic(() => s);
  for (let i = 20; i >= 0; i--) {
    const ds = addDays(t, -i);
    for (const d of L.dosesFor(ds, null, now)) {
      if (i === 9 && d.key === 'm1|20:00') continue;
      if (i === 0 && at(ds, d.time) > now - 2 * 3600000) continue;
      (s.logs[ds] || (s.logs[ds] = {}))[d.key] = 't' + d.time.replace(':', '');
    }
  }
  return s;
}

export function waNumber(phone, cc) { let d = String(phone || '').replace(/\D/g, '').replace(/^0+/, ''); if (d && d.length <= 10) d = (cc || '') + d; return d; }
export const telHref = phone => String(phone || '').replace(/[^\d+]/g, '');
export function notifId(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 999999999 + 1; }
