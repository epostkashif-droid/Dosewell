import { APP } from './config.js';
import {
  pad, ymd, fromYmd, addDays, today, fmtTime, at, DOW, niceDate, FORMS, FOODS, RELATIONS, BLOODS, REC_TYPES, LIMITS,
  isDate, isId, isTime, str, blank, sanitizeState, sanitizeRecord, makeLogic, sampleState, waNumber, telHref
} from './logic.js';
import { native, store, reminders, sharing, clip, setBars, onAppEvents, HORIZON_DAYS } from './platform.js';
import { THEMES, getTheme, shareColors } from './themes.js';

/* ============ state ============ */
let state = blank(), records = [];
const L = makeLogic(() => state);
let tab = 'today', who = null, viewDate = today(), recFilter = 'All', onbStep = 0, remStatus = { supported: false };
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const person = id => state.people.find(p => p.id === id);
const med = id => state.meds.find(m => m.id === id);
const isSelf = p => p.relation === 'Self' || /^(me|myself)$/i.test(p.name);
const qtyText = m => /^(Tablet|Capsule)$/.test(m.form) ? (m.qty || 1) + ' ' + m.form.toLowerCase() + ((m.qty || 1) > 1 ? 's' : '') : '';
const medMeta = m => [m.strength, qtyText(m), m.food !== 'Any time' ? m.food.toLowerCase() : ''].filter(Boolean).join(' · ');
const TABS = [['today', 'Today'], ['meds', 'Medicines'], ['records', 'Records'], ['progress', 'Progress'], ['more', 'More']];

let syncTimer = null;
function save() {
  state.updatedAt = Date.now();
  L.pruneLogs();
  state = sanitizeState(state);
  store.saveState(state);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncReminders, 1200);
}
function syncReminders() { reminders.sync(L.upcoming(HORIZON_DAYS), state.people, state.settings); }
let barsKey = null;
function applyTheme() {
  const root = document.documentElement, t = state.settings.theme, sk = getTheme(state.settings.skin).id;
  if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
  if (root.dataset.skin !== sk) root.dataset.skin = sk;
  let dark = t === 'dark'; try { if (t === 'system') dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { /* ignore */ }
  const th = getTheme(sk), bg = dark ? th.dark.bg : th.light.bg, key = sk + dark;
  if (key !== barsKey) { barsKey = key; setBars(dark, bg); }
}

/* ============ icons ============ */
const ICON = {
  today: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  meds: '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M9.2 9.2l5.6 5.6"/>',
  records: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5v4h4M10 12h5M10 15.5h5"/>',
  progress: '<path d="M5 19.5V13M10 19.5V8M15 19.5v-5M20 19.5V5"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  minus: '<path d="M7 12h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14zM10 19.5a2 2 0 0 0 4 0"/>',
  flame: '<path d="M12 3.5c.6 3.4 4.5 5 4.5 9.4a4.5 4.5 0 0 1-9 0c0-1.7.8-2.9 1.7-3.9.4 1.2 1 1.8 1.6 2 .2-3 .7-5.500 1.200-7.500z"/>',
  share: '<path d="M12 15V4M8 7.500l4-4 4 4M5 12.500V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.500"/>',
  camera: '<path d="M4 8.500A1.500 1.500 0 0 1 5.500 7H8l1.500-2h5L16 7h2.500A1.500 1.500 0 0 1 20 8.500v9a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 17.500z"/><circle cx="12" cy="13" r="3.200"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l4.500-4.500 3.500 3.500 2.500-2.500L20 17"/><circle cx="15.500" cy="9.500" r="1.200"/>',
  shield: '<path d="M12 3.500l7 2.500v5.500c0 4.300-3 7.600-7 9-4-1.400-7-4.700-7-9V6z"/><path d="M9 12l2.200 2.200L15 10.500"/>',
  heart: '<path d="M12 20s-7-4.400-7-9.600A3.900 3.900 0 0 1 12 8a3.900 3.900 0 0 1 7 2.400C19 15.600 12 20 12 20z"/>',
  tablet: '<circle cx="12" cy="12" r="8"/><path d="M6.500 12h11"/>',
  bottle: '<path d="M9.500 3.500h5v3l1.500 2V20a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 8 20V8.500l1.500-2zM8 12.500h8M8 16.500h8"/>',
  drop: '<path d="M12 3.500c3 4 5.500 6.700 5.500 10a5.500 5.500 0 0 1-11 0c0-3.300 2.500-6 5.500-10z"/>',
  cross: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8.500v7M8.500 12h7"/>'
};
const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const formIcon = f => svg(f === 'Tablet' ? 'tablet' : f === 'Capsule' ? 'meds' : f === 'Syrup' ? 'bottle' : f === 'Drops' ? 'drop' : 'cross');
const ART = `<svg class="art" viewBox="0 0 200 200" aria-hidden="true"><rect x="18" y="62" width="164" height="92" rx="24" fill="var(--surface)"/><g>${[['--mint', 0], ['--peach', 1], ['--sky', 2], ['--butter', 3]].map(([c, i]) => `<rect x="${30 + i * 37}" y="74" width="30" height="68" rx="12" fill="var(${c})"/>`).join('')}</g><rect x="36" y="98" width="18" height="30" rx="9" fill="var(--mint-ink)"/><circle cx="82" cy="112" r="10" fill="var(--peach-ink)"/><rect x="110" y="98" width="18" height="30" rx="9" fill="var(--sky-ink)"/><circle cx="156" cy="112" r="10" fill="none" stroke="var(--butter-ink)" stroke-width="3" stroke-dasharray="4 4"/><circle cx="150" cy="50" r="22" fill="var(--primary)"/><path d="M140 50l7 7 13-14" fill="none" stroke="var(--on-primary)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
async function copyText(text, okMsg) {
  if (clip(text)) { toast(okMsg || 'Copied'); return; }
  try { await navigator.clipboard.writeText(text); toast(okMsg || 'Copied'); }
  catch (e) { openSheet(`<h2>Copy this text</h2><p class="muted small">Press and hold to select it, then copy.</p><textarea class="copybox" id="copybox" readonly>${esc(text)}</textarea><button class="btn wide" data-a="close">Done</button>`); const b = $('#copybox'); if (b) b.select(); }
}
const waLink = (phone, text) => 'https://wa.me/' + (phone ? waNumber(phone, state.settings.cc) : '') + '?text=' + encodeURIComponent(text);
const smsLink = (phone, text) => 'sms:' + telHref(phone) + '?body=' + encodeURIComponent(text);
const telLink = (phone, label) => `<a class="tel" href="tel:${esc(telHref(phone))}">${esc(label || phone)}</a>`;
const avatar = (p, sm) => `<span class="avatar ${sm ? 'sm ' : ''}av-${p ? p.color % 6 : 0}">${esc((p ? p.name[0] : '?').toUpperCase())}</span>`;

/* ============ views ============ */
function chips() {
  if (state.people.length < 2) return '';
  return `<div class="chips" role="group" aria-label="Show medicines for">
    <button class="chip plain" data-a="who" data-id="" aria-pressed="${!who}">Everyone</button>
    ${state.people.map(p => `<button class="chip" data-a="who" data-id="${esc(p.id)}" aria-pressed="${who === p.id}">${avatar(p, 1)}${esc(p.name)}</button>`).join('')}</div>`;
}
function sampleBanner() { return state.sample ? `<div class="banner"><h3>You are exploring sample data</h3><p class="small">Amma, Zoya and their medicines are examples.</p><div class="btnrow"><button class="btn sm" data-a="start-fresh">Clear and add my own</button></div></div>` : ''; }
function systemBanners() {
  let h = '';
  if (remStatus.supported && !remStatus.allowed && state.meds.length) h += `<div class="banner warn"><h3>Reminders are off</h3><p class="small">Dosewell needs permission to show a notification when a dose is due.</p><div class="btnrow"><button class="btn sm" data-a="ask-notif">Turn on reminders</button></div></div>`;
  return h;
}
function alertBanners() {
  const th = state.settings.threshold; let h = '';
  for (const p of state.people) {
    if (who && who !== p.id) continue;
    const run = L.missedRun(p.id); if (run.length < th) continue;
    const sig = run[0].date + '|' + run[0].key + '|' + run.length; if (state.settings.ack[p.id] === sig) continue;
    const guards = state.contacts.filter(c => c.guardian);
    h += `<div class="banner alert" role="alert"><h3>${esc(p.name)} has missed ${run.length} doses in a row</h3>
      <p class="small">Last missed: ${esc(run[0].med.name)}, ${niceDate(run[0].date)} ${fmtTime(run[0].time)}.</p>
      <div class="btnrow"><button class="btn sm" data-a="guardian" data-id="${esc(p.id)}">${guards.length ? 'Tell ' + esc(guards[0].name) : 'Tell a guardian'}</button><button class="btn sm" data-a="ack" data-id="${esc(p.id)}" data-sig="${esc(sig)}">Dismiss</button></div></div>`;
  }
  return h;
}
function refillBanners() {
  let h = '';
  for (const m of state.meds) {
    if ((who && m.personId !== who) || m.active === false) continue;
    const d = L.daysLeft(m);
    if (d !== null && d <= 5) { const p = person(m.personId); h += `<div class="banner warn"><p><strong>${esc(m.name)}</strong> is running low${p ? ' for ' + esc(p.name) : ''}: ${m.stock} left, about ${d} day${d === 1 ? '' : 's'}.</p><div class="btnrow"><button class="btn sm" data-a="edit-med" data-id="${esc(m.id)}">Update stock</button></div></div>`; }
  }
  return h;
}
function doseRow(d) {
  const p = person(d.med.personId), st = d.status;
  const pill = st === 'due' ? '<span class="pill warn">Due now</span>' : st === 'missed' ? '<span class="pill bad">Missed</span>' : st === 'skipped' ? '<span class="pill off">Skipped</span>' : '';
  const done = st === 'taken' || st === 'skipped';
  return `<li class="dose is-${st}"><button class="dose-main" data-a="dose" data-d="${d.date}" data-k="${esc(d.key)}">
    <span class="tile av-${p ? p.color % 6 : 0}">${formIcon(d.med.form)}</span>
    <span class="dose-txt"><span class="when">${fmtTime(d.time)}${p && !who && state.people.length > 1 ? ' · ' + esc(p.name) : ''} ${pill}</span><b>${esc(d.med.name)}</b><span class="meta">${esc(medMeta(d.med))}</span></span></button>
    <button class="tick" data-a="${done ? 'dose' : 'take'}" data-d="${d.date}" data-k="${esc(d.key)}" aria-label="${done ? 'Change ' : 'Mark taken: '}${esc(d.med.name)} ${fmtTime(d.time)}">${svg(st === 'skipped' ? 'minus' : 'check')}</button></li>`;
}
function viewToday() {
  const t = today(), doses = L.dosesFor(viewDate, who), taken = doses.filter(d => d.status === 'taken').length;
  const hr = new Date().getHours(), greet = hr < 5 ? 'Hello' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  let week = '';
  for (let i = 6; i >= 0; i--) { const ds = addDays(t, -i), d = fromYmd(ds); week += `<button class="cell ${L.dayStatus(ds, who)}" data-a="day" data-d="${ds}" aria-current="${ds === viewDate}" aria-label="${niceDate(ds)}: ${L.dayStatus(ds, who)}"><span class="d">${DOW[d.getDay()][0]}</span><span class="n">${d.getDate()}</span><span class="m"></span></button>`; }
  const groups = [['Morning', 0, 12], ['Afternoon', 12, 17], ['Evening', 17, 21], ['Night', 21, 24]];
  let list = '';
  for (const [g, a, b] of groups) { const ds = doses.filter(d => { const h = +d.time.slice(0, 2); return h >= a && h < b; }); if (ds.length) list += `<h2 class="section-h">${g}</h2><ul class="doses">${ds.map(doseRow).join('')}</ul>`; }
  if (!state.people.length) list = `<div class="card stack blankcard">${ART}<h2>Add the first person</h2><p class="muted">Yourself, a parent or a child. Then add their medicines.</p><button class="btn primary" data-a="edit-person">Add a person</button></div>`;
  else if (!state.meds.length) list = `<div class="card stack blankcard">${ART}<h2>No medicines yet</h2><p class="muted">Add a medicine with its dose times and Dosewell reminds you.</p><button class="btn primary" data-a="edit-med">Add a medicine</button></div>`;
  else if (!doses.length) list = `<div class="card"><p class="muted">Nothing scheduled for ${viewDate === t ? 'today' : niceDate(viewDate)}.</p></div>`;
  const next = viewDate === t ? doses.find(d => d.status === 'due' || d.status === 'upcoming') : null;
  const C = 2 * Math.PI * 38, frac = doses.length ? taken / doses.length : 0, s = who ? L.streak(who) : 0;
  const hero = doses.length ? `<section class="card hero"><div class="ring"><svg viewBox="0 0 92 92"><circle class="t" cx="46" cy="46" r="38"/><circle class="p" cx="46" cy="46" r="38" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}"/></svg><b><span>${taken}<small>/${doses.length}</small></span></b></div>
    <div class="stack" style="gap:6px"><h2>${taken === doses.length ? 'All done' : taken + ' of ' + doses.length + ' taken'}</h2><p class="muted small">${next ? 'Next: ' + esc(next.med.name) + ' at ' + fmtTime(next.time) : taken === doses.length ? 'Every dose is marked for this day.' : 'Tap the circle on a dose to mark it.'}</p>${s ? `<span class="pill gold" style="align-self:flex-start">${svg('flame')}${s}-day streak</span>` : ''}</div></section>` : '';
  return `<header class="bar"><div><p class="eyebrow">${viewDate === t ? niceDate(t) : 'Viewing an earlier day'}</p><h1>${viewDate === t ? greet : niceDate(viewDate)}</h1></div>${viewDate !== t ? `<button class="btn sm" data-a="day" data-d="${t}">Today</button>` : ''}</header>
  ${sampleBanner()}${systemBanners()}${chips()}${alertBanners()}
  <section class="week" aria-label="Last seven days">${week}</section>
  ${hero}${refillBanners()}${list}`;
}
function viewMeds() {
  let h = `<header class="bar"><h1>Medicines</h1></header>${chips()}`;
  if (!state.people.length) return h + `<div class="card stack blankcard">${ART}<h2>Add a person first</h2><p class="muted">Medicines belong to a person.</p><button class="btn primary" data-a="edit-person">Add a person</button></div>`;
  for (const p of state.people) {
    if (who && who !== p.id) continue;
    const ms = state.meds.filter(m => m.personId === p.id);
    h += `<section class="card"><div class="row">${avatar(p)}<h2 class="grow">${esc(p.name)}</h2><span class="muted small">${ms.length} medicine${ms.length === 1 ? '' : 's'}</span></div>
    ${ms.length ? `<ul class="list">${ms.map(m => { const d = L.daysLeft(m); return `<li><button class="rowbtn" data-a="edit-med" data-id="${esc(m.id)}"><span class="tile av-${p.color % 6}">${formIcon(m.form)}</span><span class="grow"><strong>${esc(m.name)}</strong> <span class="muted">${esc(m.strength)}</span><span class="small muted" style="display:block">${m.times.map(fmtTime).join(', ')} · ${m.days.length === 7 ? 'every day' : m.days.map(x => DOW[x]).join(' ')}</span>${m.active === false ? '<span class="pill off">Paused</span> ' : ''}${d !== null && d <= 5 ? `<span class="pill warn">${m.stock} left</span>` : ''}</span>${svg('chev').replace('<svg', '<svg class="chev"')}</button></li>`; }).join('')}</ul>` : `<p class="muted small" style="margin-top:10px">No medicines added yet.</p>`}</section>`;
  }
  return h;
}
function viewRecords() {
  const rs = records.filter(r => (!who || r.personId === who) && (recFilter === 'All' || r.type === recFilter)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  return `<header class="bar"><h1>Records</h1></header>${chips()}
  <div class="chips" role="group" aria-label="Record type">${['All', ...REC_TYPES].map(t => `<button class="chip plain" data-a="rtype" data-t="${t}" aria-pressed="${recFilter === t}">${t}</button>`).join('')}</div>
  ${rs.length ? `<div class="recs">${rs.map(r => { const p = person(r.personId); return `<button class="rec" data-a="view-rec" data-id="${esc(r.id)}"><img src="${esc(r.img)}" alt=""><div><strong>${esc(r.title)}</strong><span class="small muted">${esc(r.type)} · ${niceDate(r.date)}${p ? ' · ' + esc(p.name) : ''}</span></div></button>`; }).join('')}</div>` : `<div class="card stack blankcard">${ART}<h2>Keep prescriptions handy</h2><p class="muted">Photograph a prescription slip, lab report or bill and pull it up at the clinic.</p><button class="btn primary" data-a="add-rec">${svg('camera')}Add a photo</button></div>`}`;
}
const MILESTONES = [[3, '3 days'], [7, 'One week'], [14, 'Two weeks'], [30, '30 days'], [60, '60 days'], [100, '100 days']];
function viewProgress() {
  const t = today(); let h = `<header class="bar"><h1>Progress</h1></header>${chips()}`;
  const ppl = state.people.filter(p => (!who || who === p.id) && state.meds.some(m => m.personId === p.id));
  if (!ppl.length) return h + `<div class="card stack blankcard">${ART}<h2>Streaks start here</h2><p class="muted">Add a medicine and mark doses to build a streak.</p></div>`;
  for (const p of ppl) {
    const s = L.streak(p.id), b = Math.max(L.bestStreak(p.id), s), a = L.adherence(p.id, 30);
    let g = ''; for (let i = 27; i >= 0; i--) { const ds = addDays(t, -i), st = L.dayStatus(ds, p.id); g += `<span class="sq ${st}" title="${niceDate(ds)}: ${st}"></span>`; }
    const meds = state.meds.filter(m => m.personId === p.id);
    let hist = ''; for (let i = 0; i < 7; i++) { const ds = addDays(t, -i); for (const d of L.dosesFor(ds, p.id).reverse()) { if (d.status === 'upcoming') continue; const cls = { taken: 'ok', missed: 'bad', skipped: 'off', due: 'warn' }[d.status]; hist += `<span class="muted">${niceDate(ds)} ${fmtTime(d.time)}</span><span>${esc(d.med.name)}</span><span class="pill ${cls}">${d.status}</span>`; } }
    h += `<section class="card stack"><div class="row">${avatar(p)}<h2 class="grow">${esc(p.name)}</h2><button class="btn primary sm" data-a="share" data-id="${esc(p.id)}">${svg('share')}Share</button></div>
      <div class="streak"><span class="num">${s}</span><div><h3>day streak</h3><p class="small muted">Best ${b} · ${a.pct === null ? 'no doses yet' : a.pct + '% taken in 30 days'}</p></div></div>
      <div class="grid28" aria-label="Last 28 days">${g}</div>
      <div class="legend"><span><i style="background:#7FD3AC"></i>All taken</span><span><i style="background:#F3CB67"></i>Some missed</span><span><i style="background:#F29BB0"></i>None taken</span></div>
      <div class="badges">${MILESTONES.map(([n, l]) => `<span class="badge ${b >= n ? 'won' : ''}">${l}</span>`).join('')}</div>
      <div class="stack">${meds.map(m => { const x = L.adherence(p.id, 30, Date.now(), m.id); return `<div class="medbar"><span>${esc(m.name)}</span><span>${x.pct === null ? '–' : x.pct + '%'}</span><div class="meter"><i style="width:${x.pct || 0}%"></i></div></div>`; }).join('')}</div>
      <details><summary>Last 7 days, dose by dose</summary><div class="hist">${hist || '<span class="muted">Nothing yet.</span>'}</div></details>
      <button class="btn" data-a="report" data-id="${esc(p.id)}">Copy a 30-day report for the doctor</button></section>`;
  }
  return h;
}
const sw = (key, on, label, sub) => `<li><div class="grow"><strong>${label}</strong>${sub ? `<div class="small muted">${sub}</div>` : ''}</div><label class="switch"><input type="checkbox" id="set-${key}" data-set="${key}" ${on ? 'checked' : ''} aria-label="${label}"><span></span></label></li>`;
function viewMore() {
  const st = state.settings;
  return `<header class="bar"><h1>More</h1></header>${sampleBanner()}
  <h2 class="section-h">Family</h2>
  <section class="card"><div class="row"><h2 class="grow">People</h2><button class="btn sm" data-a="edit-person">${svg('plus')}Add</button></div>
    ${state.people.length ? `<ul class="list">${state.people.map(p => `<li><button class="rowbtn" data-a="edit-person" data-id="${esc(p.id)}">${avatar(p)}<span class="grow"><strong>${esc(p.name)}</strong><span class="small muted" style="display:block">${esc([p.relation, p.blood && 'Blood ' + p.blood].filter(Boolean).join(' · '))}</span></span></button><button class="btn sm" data-a="ecard" data-id="${esc(p.id)}">Emergency card</button></li>`).join('')}</ul>` : '<p class="muted small" style="margin-top:10px">Add yourself, a parent or a child.</p>'}</section>
  <section class="card"><div class="row"><h2 class="grow">Emergency contacts</h2><button class="btn sm" data-a="edit-contact">${svg('plus')}Add</button></div>
    ${state.contacts.length ? `<ul class="list">${state.contacts.map(c => `<li><button class="rowbtn" data-a="edit-contact" data-id="${esc(c.id)}"><span class="grow"><strong>${esc(c.name)}</strong> <span class="muted small">${esc(c.relation)}</span>${c.guardian ? ' <span class="pill ok">Guardian</span>' : ''}<span class="small muted" style="display:block">${esc(c.phone)}</span></span></button>${telLink(c.phone, 'Call')}</li>`).join('')}</ul>` : '<p class="muted small" style="margin-top:10px">Add who to call first. Mark one as guardian to tell them about missed doses.</p>'}</section>
  <h2 class="section-h">Reminders</h2>
  <section class="card"><ul class="list">
    ${remStatus.supported ? `<li><div class="grow"><strong>Phone notifications</strong><div class="small muted">${remStatus.allowed ? 'On. Reminders arrive even when Dosewell is closed, planned ' + HORIZON_DAYS + ' days ahead.' : 'Off. Turn on to get reminders.'}</div></div>${remStatus.allowed ? '<span class="pill ok">On</span>' : '<button class="btn sm" data-a="ask-notif">Turn on</button>'}</li>
    ${remStatus.allowed ? `<li><div class="grow"><strong>On-the-minute alarms</strong><div class="small muted">${remStatus.exact ? 'Allowed.' : 'Not allowed, so Android may delay a reminder by a few minutes.'}</div></div>${remStatus.exact ? '<span class="pill ok">On</span>' : '<button class="btn sm" data-a="ask-exact">Allow</button>'}</li>` : ''}` : ''}
    ${sw('sound', st.sound, 'Sounds in the app', 'The look\'s chime when a dose is due or marked taken, while Dosewell is open')}
    ${sw('followUp', st.followUp, 'Remind again after 45 minutes', 'If the dose is still not marked')}
    ${sw('discreet', st.discreet, 'Hide medicine names in notifications', 'Shows "Time for a medicine" instead')}
    <li><label class="f grow" for="set-threshold" style="color:var(--ink)">Guardian alert after<select id="set-threshold" data-set="threshold">${[2, 3, 4, 5, 6].map(n => `<option value="${n}" ${st.threshold === n ? 'selected' : ''}>${n} missed doses in a row</option>`).join('')}</select></label></li>
    <li><label class="f grow" for="set-snooze" style="color:var(--ink)">Snooze for<select id="set-snooze" data-set="snooze">${[5, 10, 15, 30].map(n => `<option value="${n}" ${st.snooze === n ? 'selected' : ''}>${n} minutes</option>`).join('')}</select></label></li>
    <li><label class="f grow" for="set-cc" style="color:var(--ink)">Country code for WhatsApp<input id="set-cc" data-set="cc" inputmode="numeric" maxlength="4" value="${esc(st.cc)}"></label></li>
    <li><button class="btn wide" data-a="test-alarm">${svg('bell')}Test the alarm</button></li></ul>
    ${native ? '' : '<p class="small muted">In a browser, alarms ring only while this page is open. The Android app reminds you with notifications even when closed.</p>'}</section>
  <h2 class="section-h">Appearance</h2>
  <section class="card stack"><h2>Look</h2><p class="small muted">Each look changes the colours, background, lettering, movement and sounds.</p>${looksGrid()}
    <h3>Light or dark</h3><div class="seg" role="group" aria-label="Light or dark">${[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button data-a="theme" data-t="${k}" aria-pressed="${st.theme === k}">${l}</button>`).join('')}</div></section>
  <h2 class="section-h">Your data</h2>
  <section class="card stack"><p class="small muted">${native ? 'Everything stays on this phone. Dosewell has no account, no server and no ads.' : store.synced ? 'Saved in your private space. Nobody else who opens this page can see it.' : 'Saved in this browser only.'}</p>
    <p class="small muted">A backup file is not locked. It holds health information, so keep it somewhere only you can reach.</p>
    <div class="btnrow"><button class="btn" data-a="export">Back up to a file</button><label class="btn" for="imp">Restore a backup<input id="imp" type="file" accept="application/json,.json" hidden></label></div>
    <button class="btn danger" data-a="ask-reset">Erase everything</button></section>
  <h2 class="section-h">About</h2>
  <section class="card"><ul class="list">
    <li><div class="grow"><strong>${esc(APP.name)} ${esc(APP.version)}</strong><div class="small muted">Made by ${esc(APP.maker)}, ${esc(APP.place)}</div>${APP.email ? `<div class="small"><a class="tel" href="mailto:${esc(APP.email)}">${esc(APP.email)}</a></div>` : ''}</div></li>
    <li><button class="rowbtn" data-a="privacy">${svg('shield')}<strong>Privacy policy</strong>${svg('chev').replace('<svg', '<svg class="chev"')}</button></li>
    <li><button class="rowbtn" data-a="disclaimer">${svg('heart')}<strong>Medical disclaimer</strong>${svg('chev').replace('<svg', '<svg class="chev"')}</button></li></ul></section>`;
}
function looksGrid() {
  const cur = getTheme(state.settings.skin).id, dark = document.documentElement.dataset.theme === 'dark' || (state.settings.theme === 'system' && (() => { try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } })());
  return `<div class="looks" role="group" aria-label="Look">${THEMES.map(t => { const c = dark ? t.dark : t.light; return `<button class="look" data-a="skin" data-t="${t.id}" aria-pressed="${cur === t.id}" aria-label="${esc(t.name)}: ${esc(t.tagline)}">
    <span class="pv" style="background:${c.bg};background-image:linear-gradient(135deg,${c['primary-soft']},${c.bg} 70%)">${cur === t.id ? `<span class="ok">${svg('check')}</span>` : ''}<i style="background:${c.primary}"></i><i style="background:${c.good}"></i><i style="background:${c.some}"></i><i style="background:${c.bad}"></i><b style="color:${c.ink};font-family:${t.display === 'Fraunces' ? 'Fraunces,serif' : t.display === 'Nunito' ? 'Nunito,sans-serif' : t.display === 'Atkinson' ? 'Atkinson,sans-serif' : 'Jakarta,sans-serif'}">Aa</b></span>
    <span class="nm"><strong>${esc(t.name)}</strong><span>${esc(t.tagline)}</span></span></button>`; }).join('')}</div>`;
}
const DISCLAIMER = `<p>Dosewell is a reminder and record-keeping tool. It does not give medical advice, diagnose, or recommend any medicine or dose.</p><p>Always follow your doctor's or pharmacist's instructions. Do not start, stop or change a medicine because of anything shown in this app. Talk to a qualified healthcare professional first.</p><p>A reminder can be delayed or missed if the phone is off, silenced, out of battery, or if notifications are blocked. Do not rely on Dosewell alone for medicines where timing is critical.</p><p>In an emergency, call your local emergency number.</p>`;
const PRIVACY = `<p><strong>Short version: your information stays with you.</strong></p>
<h3>What Dosewell stores</h3><p>Names and details of the people you add, their medicines and schedules, the doses you mark, emergency contacts, and the photos of records you save.</p>
<h3>Where it is stored</h3><p>${native ? 'Only on this phone, inside the app\'s private storage. Dosewell has no account and no server. The maker cannot see your information.' : 'In this browser, and in your private space if you are signed in. The maker cannot see your information.'}</p>
<h3>What is shared</h3><p>Nothing, unless you choose to. When you tap Share, Tell a guardian, or Back up, Dosewell hands the text or file to the app you pick (for example WhatsApp or Messages). Dosewell has no ads, no analytics and no trackers.</p>
<h3>Permissions</h3><p>Notifications and alarms, to remind you at the times you set. The camera opens only when you tap Take a photo. ${native ? 'Dosewell has no internet permission, so it cannot send anything anywhere.' : ''}</p>
<h3>Deleting your data</h3><p>More, then Erase everything removes all of it at once. Uninstalling the app also removes it.</p>
<h3>Children</h3><p>Dosewell is meant for adults, including adults managing a child's medicines.</p>
<h3>Contact</h3><p>${esc(APP.maker)}, ${esc(APP.place)}${APP.email ? '. ' + esc(APP.email) : ''}.</p>`;
function viewOnboarding() {
  const dots = `<div class="dots">${[0, 1, 2].map(i => `<i class="${i === onbStep ? 'on' : ''}"></i>`).join('')}</div>`;
  if (onbStep === 0) return `<div class="stack onb" style="gap:20px">${ART}<div class="stack" style="text-align:center"><h1>Never miss a dose</h1><p class="muted">Reminders for you, your parents and your children. A record of every dose, and a nudge to a guardian when doses are missed.</p></div>
    <div class="stack" style="gap:8px;text-align:center"><p class="small muted">Pick a look. You can change it any time.</p><div class="swatches" role="group" aria-label="Look">${THEMES.map(t => `<button class="swatch" data-a="skin" data-t="${t.id}" aria-pressed="${getTheme(state.settings.skin).id === t.id}" aria-label="${esc(t.name)}" style="background:linear-gradient(135deg,${t.light['primary-soft']} 0 50%,${t.light.primary} 50%)"></button>`).join('')}</div><p class="small" style="font-weight:800">${esc(getTheme(state.settings.skin).name)}</p></div>${dots}<button class="btn primary wide" data-a="onb-next">Get started</button></div>`;
  if (onbStep === 1) return `<div class="stack onb" style="gap:16px"><h1>Before you begin</h1><div class="card prose">${svg('heart').replace('<svg', '<svg width="28" height="28" style="color:var(--rose-ink)"')}<p>Dosewell reminds and records. It does not give medical advice. Always follow your doctor or pharmacist.</p></div><div class="card prose">${svg('shield').replace('<svg', '<svg width="28" height="28" style="color:var(--mint-ink)"')}<p>${native ? 'Your information stays on this phone. No account, no server, no ads.' : 'Your information stays private to you. No ads, no trackers.'}</p></div>
    <label class="check" for="onb-ok"><input type="checkbox" id="onb-ok"> I understand that Dosewell is not a substitute for medical advice.</label>
    <div class="btnrow"><button class="btn quiet" data-a="disclaimer">Read the full disclaimer</button><button class="btn quiet" data-a="privacy">Privacy policy</button></div>${dots}<button class="btn primary wide" data-a="onb-accept">Continue</button></div>`;
  return `<div class="stack onb" style="gap:16px"><h1>Who is this for?</h1><p class="muted">Add the first person. You can add more later.</p>
    <form data-form="person" data-id="" class="stack"><div class="two"><label class="f" for="p-name">Name<input id="p-name" name="name" required maxlength="40" autocomplete="off"></label>
    <label class="f" for="p-rel">Relation<select id="p-rel" name="relation">${opt(RELATIONS, 'Self')}</select></label></div>${dots}
    <button class="btn primary wide">Continue</button></form><button class="btn quiet wide" data-a="try-sample">Explore with sample data first</button></div>`;
}
let animateNext = false, justTaken = null;
function render() {
  applyTheme();
  const onb = !state.settings.onboarded;
  $('#navwrap').hidden = onb;
  const appEl = $('#app');
  if (onb) { $('#fab').hidden = true; appEl.innerHTML = viewOnboarding(); return; }
  const prevTab = tab;
  tab = TABS.some(x => '#' + x[0] === location.hash) ? location.hash.slice(1) : 'today';
  if (who && !person(who)) who = null;
  appEl.innerHTML = { today: viewToday, meds: viewMeds, records: viewRecords, progress: viewProgress, more: viewMore }[tab]();
  if (tab !== prevTab || animateNext) { animateNext = false; appEl.classList.remove('enter'); void appEl.offsetWidth; appEl.classList.add('enter'); setTimeout(() => appEl.classList.remove('enter'), 700); }
  if (justTaken) { for (const el of appEl.querySelectorAll('.dose')) { const b = el.querySelector('.tick'); if (b && b.dataset.k === justTaken.k && b.dataset.d === justTaken.d) el.classList.add('just-taken'); } justTaken = null; }
  $('#nav').innerHTML = TABS.map(([k, l]) => `<a href="#${k}" ${k === tab ? 'aria-current="page"' : ''}><i>${svg(k)}</i><span>${l}</span></a>`).join('');
  const fab = $('#fab'), showFab = (tab === 'today' || tab === 'meds') ? state.people.length > 0 : tab === 'records';
  fab.hidden = !showFab; fab.innerHTML = svg('plus'); fab.setAttribute('aria-label', tab === 'records' ? 'Add a record' : 'Add a medicine');
}

/* ============ sheets ============ */
let lastFocus = null;
function openSheet(html) { if (!sheetOpen()) lastFocus = document.activeElement; $('#panel').innerHTML = html; $('#sheet').classList.add('open'); const p = $('#panel'); p.scrollTop = 0; try { p.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
function closeSheet() { if (!sheetOpen()) return; $('#sheet').classList.remove('open'); $('#panel').innerHTML = ''; try { if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } lastFocus = null; }
const sheetOpen = () => $('#sheet').classList.contains('open');
const opt = (arr, sel) => arr.map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v) || 'Not known'}</option>`).join('');
const timeRow = v => `<div class="trow"><input type="time" name="time" id="t-${uid()}" value="${esc(v)}" required aria-label="Dose time"><button type="button" class="btn sm quiet" data-a="rm-time" aria-label="Remove this time">Remove</button></div>`;
function medSheet(id) {
  if (!state.people.length) { personSheet(); return; }
  if (!id && state.meds.length >= LIMITS.meds) { toast('You have reached the limit of ' + LIMITS.meds + ' medicines'); return; }
  const m = med(id) || { personId: who || state.people[0].id, name: '', strength: '', form: 'Tablet', qty: 1, times: ['08:00'], days: [0, 1, 2, 3, 4, 5, 6], food: 'After food', start: today(), end: '', stock: null, notes: '' };
  openSheet(`<h2>${id ? 'Edit medicine' : 'Add a medicine'}</h2><form data-form="med" data-id="${esc(id || '')}">
    <label class="f" for="m-person">For<select id="m-person" name="personId">${state.people.map(p => `<option value="${esc(p.id)}" ${p.id === m.personId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label class="f" for="m-name">Medicine name<input id="m-name" name="name" required maxlength="60" value="${esc(m.name)}" placeholder="e.g. Metformin" autocomplete="off"></label>
    <div class="two"><label class="f" for="m-str">Strength<input id="m-str" name="strength" maxlength="30" value="${esc(m.strength)}" placeholder="500 mg"></label>
    <label class="f" for="m-form">Type<select id="m-form" name="form">${opt(FORMS, m.form)}</select></label></div>
    <div class="f">Times<div id="times" class="stack" style="gap:8px">${m.times.map(timeRow).join('')}</div><button type="button" class="btn sm" data-a="add-time">${svg('plus')}Add another time</button></div>
    <div class="f">Days<div class="daychips">${DOW.map((d, i) => `<label><input type="checkbox" name="day" id="d-${i}" value="${i}" ${m.days.includes(i) ? 'checked' : ''} aria-label="${d}"><span>${d[0]}</span></label>`).join('')}</div></div>
    <div class="two"><label class="f" for="m-qty">Amount each time<input id="m-qty" name="qty" type="number" inputmode="decimal" min="0.25" max="99" step="0.25" value="${m.qty || 1}"></label>
    <label class="f" for="m-food">Food<select id="m-food" name="food">${opt(FOODS, m.food)}</select></label></div>
    <div class="two"><label class="f" for="m-start">Start date<input id="m-start" name="start" type="date" value="${m.start}" required></label>
    <label class="f" for="m-end">End date (optional)<input id="m-end" name="end" type="date" value="${m.end || ''}"></label></div>
    <label class="f" for="m-stock">In stock (optional, for refill warnings)<input id="m-stock" name="stock" type="number" inputmode="decimal" min="0" max="99999" step="0.25" value="${typeof m.stock === 'number' ? m.stock : ''}"></label>
    <label class="f" for="m-notes">Note<input id="m-notes" name="notes" maxlength="160" value="${esc(m.notes)}" placeholder="e.g. with a full glass of water"></label>
    <button class="btn primary wide">Save medicine</button>
    ${id ? `<div class="btnrow"><button type="button" class="btn" data-a="pause-med" data-id="${esc(id)}">${m.active === false ? 'Resume reminders' : 'Pause reminders'}</button><button type="button" class="btn danger" data-a="ask-del-med" data-id="${esc(id)}">Delete</button></div>` : ''}
    <button type="button" class="btn quiet wide" data-a="close">Cancel</button></form>`);
}
function personSheet(id) {
  if (!id && state.people.length >= LIMITS.people) { toast('You can add up to ' + LIMITS.people + ' people'); return; }
  const p = person(id) || { name: '', relation: 'Self', blood: '', allergies: '', conditions: '', doctor: '', doctorPhone: '' };
  openSheet(`<h2>${id ? 'Edit person' : 'Add a person'}</h2><form data-form="person" data-id="${esc(id || '')}">
    <div class="two"><label class="f" for="p-name">Name<input id="p-name" name="name" required maxlength="40" value="${esc(p.name)}" autocomplete="off"></label>
    <label class="f" for="p-rel">Relation<select id="p-rel" name="relation">${opt(RELATIONS, p.relation)}</select></label></div>
    <label class="f" for="p-blood">Blood group<select id="p-blood" name="blood">${opt(BLOODS, p.blood)}</select></label>
    <label class="f" for="p-all">Allergies<input id="p-all" name="allergies" maxlength="160" value="${esc(p.allergies)}" placeholder="e.g. Penicillin"></label>
    <label class="f" for="p-con">Conditions<input id="p-con" name="conditions" maxlength="160" value="${esc(p.conditions)}" placeholder="e.g. Diabetes"></label>
    <div class="two"><label class="f" for="p-doc">Doctor<input id="p-doc" name="doctor" maxlength="60" value="${esc(p.doctor)}"></label>
    <label class="f" for="p-docp">Doctor's phone<input id="p-docp" name="doctorPhone" type="tel" maxlength="24" value="${esc(p.doctorPhone)}"></label></div>
    <button class="btn primary wide">Save</button>
    ${id ? `<button type="button" class="btn danger wide" data-a="ask-del-person" data-id="${esc(id)}">Delete ${esc(p.name)} and their medicines</button>` : ''}
    <button type="button" class="btn quiet wide" data-a="close">Cancel</button></form>`);
}
function contactSheet(id) {
  if (!id && state.contacts.length >= LIMITS.contacts) { toast('You can add up to ' + LIMITS.contacts + ' contacts'); return; }
  const c = state.contacts.find(x => x.id === id) || { name: '', relation: '', phone: '', guardian: !state.contacts.some(x => x.guardian) };
  openSheet(`<h2>${id ? 'Edit contact' : 'Add an emergency contact'}</h2><form data-form="contact" data-id="${esc(id || '')}">
    <label class="f" for="c-name">Name<input id="c-name" name="name" required maxlength="40" value="${esc(c.name)}" autocomplete="off"></label>
    <div class="two"><label class="f" for="c-rel">Relation<input id="c-rel" name="relation" maxlength="30" value="${esc(c.relation)}" placeholder="Brother"></label>
    <label class="f" for="c-ph">Phone<input id="c-ph" name="phone" type="tel" required maxlength="24" value="${esc(c.phone)}"></label></div>
    <label class="check" for="c-g"><input type="checkbox" name="guardian" id="c-g" ${c.guardian ? 'checked' : ''}> Guardian: tell them when doses are missed</label>
    <button class="btn primary wide">Save</button>
    ${id ? `<button type="button" class="btn danger wide" data-a="del-contact" data-id="${esc(id)}">Delete contact</button>` : ''}
    <button type="button" class="btn quiet wide" data-a="close">Cancel</button></form>`);
}
let pendingImg = null;
function recSheet() {
  if (records.length >= LIMITS.records) { toast('Record limit reached. Delete an old one first.'); return; }
  pendingImg = null;
  openSheet(`<h2>Add a record</h2><form data-form="rec">
    <div class="two"><label class="btn" for="r-cam">${svg('camera')}Take a photo<input id="r-cam" type="file" accept="image/*" capture="environment" hidden></label>
    <label class="btn" for="r-gal">${svg('image')}Choose a photo<input id="r-gal" type="file" accept="image/*" hidden></label></div>
    <div id="r-prev" class="small muted">No photo chosen yet.</div>
    <label class="f" for="r-title">Title<input id="r-title" name="title" required maxlength="80" placeholder="e.g. Dr. visit, sugar test"></label>
    <div class="two"><label class="f" for="r-type">Type<select id="r-type" name="type">${opt(REC_TYPES, 'Prescription')}</select></label>
    <label class="f" for="r-date">Date<input id="r-date" name="date" type="date" value="${today()}" max="${today()}"></label></div>
    ${state.people.length ? `<label class="f" for="r-person">For<select id="r-person" name="personId">${state.people.map(p => `<option value="${esc(p.id)}" ${p.id === who ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}
    <label class="f" for="r-note">Note<input id="r-note" name="note" maxlength="300"></label>
    <button class="btn primary wide">Save record</button><button type="button" class="btn quiet wide" data-a="close">Cancel</button></form>`);
}
async function fileToDataUrl(file) {
  if (!file || !/^image\//.test(file.type) || file.size > 40 * 1024 * 1024) throw new Error('not an image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url; });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty image');
    let max = 1500, q = .72, out = '';
    for (let k = 0; k < 10; k++) {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      if (out.length < 220000) return out;
      if (q > .5) q -= .12; else max = Math.round(max * .8);
    }
    throw new Error('too large');
  } finally { URL.revokeObjectURL(url); }
}
function doseSheet(ds, key) {
  const d = L.dosesFor(ds, null).find(x => x.key === key); if (!d) return;
  const p = person(d.med.personId), st = d.status;
  const tt = st === 'taken' && d.log.length === 5 ? ' at ' + fmtTime(d.log.slice(1, 3) + ':' + d.log.slice(3, 5)) : '';
  const label = { taken: 'Taken' + tt, skipped: 'Skipped', due: 'Due now', missed: 'Missed', upcoming: 'Upcoming' }[st], cls = { taken: 'ok', skipped: 'off', due: 'warn', missed: 'bad', upcoming: 'info' }[st];
  openSheet(`<div class="row"><span class="tile av-${p ? p.color % 6 : 0}">${formIcon(d.med.form)}</span><div class="grow"><h2>${esc(d.med.name)}</h2><p class="muted small">${esc(medMeta(d.med))}</p></div></div>
    <div class="row" style="flex-wrap:wrap"><span class="pill ${cls}">${label}</span><span class="muted small">${niceDate(ds)} · ${fmtTime(d.time)}${p ? ' · ' + esc(p.name) : ''}</span></div>
    ${d.med.notes ? `<p>${esc(d.med.notes)}</p>` : ''}
    ${st === 'taken' || st === 'skipped' ? `<button class="btn wide" data-a="undo" data-d="${ds}" data-k="${esc(key)}">Undo</button>` : `<button class="btn primary wide" data-a="take" data-d="${ds}" data-k="${esc(key)}">${svg('check')}Mark taken</button><button class="btn wide" data-a="skip" data-d="${ds}" data-k="${esc(key)}">Skip this dose</button>`}
    <button class="btn quiet wide" data-a="edit-med" data-id="${esc(d.med.id)}">Edit medicine</button>`);
}
function ecardSheet(id) {
  const p = person(id); if (!p) return; const meds = state.meds.filter(m => m.personId === id && m.active !== false);
  openSheet(`<div class="ecard"><span class="pill bad">Emergency card</span><h1 style="margin-top:8px">${esc(p.name)}</h1><dl>
    <dt>Blood group</dt><dd>${esc(p.blood || 'Not recorded')}</dd>
    <dt>Allergies</dt><dd>${esc(p.allergies || 'None recorded')}</dd>
    <dt>Conditions</dt><dd>${esc(p.conditions || 'None recorded')}</dd>
    <dt>Current medicines</dt><dd>${meds.length ? meds.map(m => esc(m.name + (m.strength ? ' ' + m.strength : '') + ', ' + m.times.length + '× a day')).join('<br>') : 'None'}</dd>
    ${p.doctor ? `<dt>Doctor</dt><dd>${esc(p.doctor)}${p.doctorPhone ? '<br>' + telLink(p.doctorPhone) : ''}</dd>` : ''}
    <dt>Call first</dt><dd>${state.contacts.length ? state.contacts.map(c => `${esc(c.name)}${c.relation ? ' (' + esc(c.relation) + ')' : ''} ${telLink(c.phone)}`).join('<br>') : 'No contacts added'}</dd></dl></div>
    <button class="btn wide" data-a="close">Close</button>`);
}
function guardianMsg(pid) { const p = person(pid), run = L.missedRun(pid); const lines = run.slice(0, 6).map(x => '- ' + x.med.name + (x.med.strength ? ' ' + x.med.strength : '') + ', ' + niceDate(x.date) + ' ' + fmtTime(x.time)); return { run, msg: `${p.name} has missed ${run.length} medicine doses in a row:\n${lines.join('\n')}\nPlease check in. (Sent from Dosewell)` }; }
function guardianSheet(pid) {
  if (!person(pid)) return;
  const { run, msg } = guardianMsg(pid), guards = state.contacts.filter(c => c.guardian);
  openSheet(`<h2>Tell a guardian</h2><p class="muted small">The message is ready. Pick how to send it; you press send.</p>
    <textarea class="copybox" id="g-msg" readonly>${esc(msg)}</textarea>
    ${guards.length ? guards.map(c => `<div class="card stack"><div><strong>${esc(c.name)}</strong> <span class="muted">${esc(c.relation)}</span><div class="small muted">${esc(c.phone)}</div></div><div class="btnrow"><a class="btn primary" href="${esc(waLink(c.phone, msg))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>${native ? `<a class="btn" href="${esc(smsLink(c.phone, msg))}">SMS</a>` : ''}<a class="btn" href="tel:${esc(telHref(c.phone))}">Call</a></div></div>`).join('') : `<div class="banner"><p>No guardian saved yet.</p><div class="btnrow"><button class="btn sm" data-a="edit-contact">Add a guardian</button></div></div><a class="btn primary" href="${esc(waLink('', msg))}" target="_blank" rel="noopener noreferrer">Open WhatsApp and pick a contact</a>`}
    <div class="btnrow"><button class="btn" data-a="copy-guardian">Copy message</button><button class="btn" data-a="ack" data-id="${esc(pid)}" data-sig="${esc(run.length ? run[0].date + '|' + run[0].key + '|' + run.length : '')}">I have told them</button></div>`);
}
function shareText(p) {
  const s = L.streak(p.id), a = L.adherence(p.id, 30), self = isSelf(p);
  if (s > 0) return `${self ? 'I have' : p.name + ' has'} taken every medicine dose on time for ${s} day${s === 1 ? '' : 's'} in a row${a.pct !== null ? ' (' + a.pct + '% this month)' : ''}. Tracked with Dosewell.`;
  return `${self ? 'I am' : p.name + ' is'} keeping up with ${self ? 'my' : 'their'} medicines${a.pct !== null ? ': ' + a.pct + '% of doses taken this month' : ''}. Tracked with Dosewell.`;
}
let shareCanvas = null, shareMsg = '';
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
async function shareSheet(pid) {
  const p = person(pid); if (!p) return; try { await document.fonts.ready; } catch (e) { /* ignore */ }
  const s = L.streak(pid), a = L.adherence(pid, 30), t = today();
  const K = shareColors(state.settings.skin);
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d'), f = (w, px) => `${w} ${px}px ${K.font}`;
  x.fillStyle = K.frame; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = K.card; rr(x, 60, 60, 960, 1230, 64); x.fill();
  x.textBaseline = 'top'; x.fillStyle = K.brand; x.font = f(800, 36); x.fillText('Dosewell', 120, 120);
  x.fillStyle = K.ink; x.font = f(800, 76); let nm = p.name; while (x.measureText(nm).width > 820 && nm.length > 3) nm = nm.slice(0, -2) + '…'; x.fillText(nm, 120, 190);
  x.fillStyle = K.tile; rr(x, 120, 320, 840, 280, 48); x.fill();
  x.fillStyle = K.tileInk; x.font = f(800, 190); x.fillText(String(s), 160, 350); const w = x.measureText(String(s)).width;
  x.font = f(800, 56); x.fillText(s === 1 ? 'day' : 'days', 190 + w, 392); x.fillText('in a row', 190 + w, 462);
  const col = { full: K.full, partial: K.partial, none: K.none, pending: K.pending, empty: K.empty };
  for (let i = 0; i < 28; i++) { const st = L.dayStatus(addDays(t, -(27 - i)), pid), cx = 120 + (i % 7) * 122, cy = 660 + Math.floor(i / 7) * 122; x.fillStyle = col[st]; rr(x, cx, cy, 106, 106, 26); x.fill(); }
  x.fillStyle = K.ink; x.font = f(700, 40); x.fillText(a.pct === null ? 'Just getting started' : a.pct + '% of doses taken in the last 30 days', 120, 1170);
  x.fillStyle = K.muted; x.font = f(500, 30); x.fillText('Last 28 days · ' + niceDate(t), 120, 1226);
  shareCanvas = c; shareMsg = shareText(p);
  openSheet(`<h2>Share ${esc(p.name)}'s streak</h2><img class="share-img" src="${c.toDataURL('image/png')}" alt="${esc(p.name)}: ${s} day streak">
    <textarea class="copybox" id="s-msg" readonly style="min-height:84px">${esc(shareMsg)}</textarea>
    ${sharing.canShareFiles ? `<button class="btn primary wide" data-a="share-native">${svg('share')}Share picture</button>` : `<p class="small muted">Press and hold the picture to save or share it.</p><a class="btn primary" href="${esc(waLink('', shareMsg))}" target="_blank" rel="noopener noreferrer">Send the message on WhatsApp</a>`}
    <div class="btnrow">${!native && store.downloads ? '<button class="btn" data-a="save-card">Save picture</button>' : ''}<button class="btn" data-a="copy-share">Copy message</button></div>
    <button class="btn quiet wide" data-a="close">Done</button>`);
}
function reportText(pid) {
  const p = person(pid), a = L.adherence(pid, 30), t = today();
  let out = `Medicine report for ${p.name}\n${niceDate(addDays(t, -29))} to ${niceDate(t)}\nOverall: ${a.taken} of ${a.total} doses taken${a.pct !== null ? ' (' + a.pct + '%)' : ''}\n`;
  for (const m of state.meds.filter(m => m.personId === pid)) { const x = L.adherence(pid, 30, Date.now(), m.id); out += `\n${m.name}${m.strength ? ' ' + m.strength : ''}, ${m.times.map(fmtTime).join(', ')}: ${x.taken} of ${x.total}${x.pct !== null ? ' (' + x.pct + '%)' : ''}`; }
  const missed = []; for (let i = 0; i < 30; i++) { const ds = addDays(t, -i); for (const d of L.dosesFor(ds, pid)) if (d.status === 'missed' || d.status === 'skipped') missed.push(`${niceDate(ds)} ${fmtTime(d.time)} ${d.med.name} (${d.status})`); }
  return out + (missed.length ? `\n\nMissed or skipped:\n${missed.join('\n')}` : '\n\nNo missed doses.');
}
function confirmSheet(title, text, action, id, label) { openSheet(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><button class="btn danger wide" data-a="${esc(action)}" data-id="${esc(id || '')}">${esc(label)}</button><button class="btn quiet wide" data-a="close">Cancel</button>`); }
function notifPrompt() { openSheet(`<div class="row"><span class="tile av-0">${svg('bell')}</span><h2 class="grow">Turn on reminders</h2></div><p class="muted">Dosewell shows a notification at each dose time, even when the app is closed. It uses notifications only for your medicine reminders.</p><button class="btn primary wide" data-a="ask-notif">Allow notifications</button><button class="btn quiet wide" data-a="close">Not now</button>`); }

/* ============ in-app alarm ============ */
let actx = null, alarmKeys = '', chimeTimer = null, testAlarm = false; const silenced = Object.create(null);
function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* no audio */ } }
// Plays one of the look's sounds: each note is [frequency, start, length, relative volume, sweep-to frequency].
function play(spec) {
  if (!state.settings.sound || !actx || !spec) return;
  try {
    const t0 = actx.currentTime + .02;
    for (const [f, d, len, rel = 1, to] of spec.notes) {
      const o = actx.createOscillator(), g = actx.createGain(), peak = spec.gain * rel, end = t0 + d + (spec.decay ? Math.max(len, spec.decay) : len);
      o.type = spec.wave; o.frequency.setValueAtTime(f, t0 + d);
      if (spec.sweep && to) o.frequency.exponentialRampToValueAtTime(to, t0 + d + len);
      g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(peak, t0 + d + .015); g.gain.exponentialRampToValueAtTime(.0008, end);
      o.connect(g).connect(actx.destination); o.start(t0 + d); o.stop(end + .05);
    }
  } catch (e) { /* no audio */ }
}
const sounds = () => getTheme(state.settings.skin).sound;
function chime() {
  play(sounds().alarm);
  try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) { /* ignore */ }
}
const dueList = () => { const now = Date.now(); return L.dueNow(now).filter(d => !((silenced[d.date + '|' + d.key] || 0) > now)); };
function showAlarm(due) {
  const keys = due.map(d => d.date + d.key).join(',') + (testAlarm ? 'T' : ''), el = $('#alarm');
  if (keys === alarmKeys && el.classList.contains('open')) return; alarmKeys = keys;
  el.innerHTML = `<div class="alarm-in"><div class="bell">${svg('bell')}</div><h1>${testAlarm ? 'This is how the alarm looks' : 'Time for ' + (due.length === 1 ? esc(due[0].med.name) : due.length + ' medicines')}</h1>
    <ul>${due.map(d => { const p = person(d.med.personId); return `<li><div class="row"><span class="tile av-${p ? p.color % 6 : 0}">${formIcon(d.med.form)}</span><div class="grow"><h3>${esc(d.med.name)} <span class="muted">${esc(d.med.strength)}</span></h3><p class="small muted">${fmtTime(d.time)}${p ? ' · ' + esc(p.name) : ''}${qtyText(d.med) ? ' · ' + esc(qtyText(d.med)) : ''}${d.med.food !== 'Any time' ? ' · ' + esc(d.med.food.toLowerCase()) : ''}</p></div></div><button class="btn primary" data-a="alarm-take" data-d="${d.date}" data-k="${esc(d.key)}">${svg('check')}Mark taken</button></li>`; }).join('')}</ul>
    <span class="grow"></span>
    ${testAlarm ? '' : `<button class="btn wide" data-a="alarm-snooze">Snooze ${state.settings.snooze} minutes</button>`}<button class="btn quiet wide" data-a="alarm-close">${testAlarm ? 'Close' : 'Not now'}</button></div>`;
  el.classList.add('open'); chime(); clearInterval(chimeTimer); chimeTimer = setInterval(chime, 4000);
}
function hideAlarm() { $('#alarm').classList.remove('open'); $('#alarm').innerHTML = ''; alarmKeys = ''; clearInterval(chimeTimer); testAlarm = false; }
let lastMin = '', lastDay = today();
function tick() {
  if (!state.settings.onboarded || testAlarm) return;
  if (lastDay !== today()) { lastDay = today(); viewDate = lastDay; lastMin = ''; syncReminders(); }
  const due = dueList(); if (due.length) showAlarm(due); else if ($('#alarm').classList.contains('open')) hideAlarm();
  const m = new Date().toTimeString().slice(0, 5);
  if (m !== lastMin) { lastMin = m; const ae = document.activeElement; if (!sheetOpen() && (tab === 'today' || tab === 'progress') && !(ae && ae.matches && ae.matches('input,select,textarea'))) render(); }
}
const stamp = () => { const n = new Date(); return 't' + pad(n.getHours()) + pad(n.getMinutes()); };
function takeDose(ds, key) {
  if (!L.markDose(ds, key, stamp())) return false;
  save(); reminders.clearDelivered(ds, key);
  justTaken = { d: ds, k: key }; unlockAudio(); play(sounds().taken);
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) { /* ignore */ }
  const m = med(key.split('|')[0]), p = m && person(m.personId);
  if (p && ds === today() && L.dayStatus(ds, p.id) === 'full') { const s = L.streak(p.id); toast(s > 1 ? `All done for ${p.name} today. ${s}-day streak.` : `All done for ${p.name} today.`); }
  return true;
}

/* ============ actions ============ */
const A = {
  close: closeSheet,
  fab: () => tab === 'records' ? recSheet() : medSheet(),
  who: d => { who = isId(d.id) ? d.id : null; render(); },
  day: d => { if (isDate(d.d) && d.d <= today()) { viewDate = d.d; render(); } },
  rtype: d => { recFilter = ['All', ...REC_TYPES].includes(d.t) ? d.t : 'All'; render(); },
  theme: d => { state.settings.theme = d.t; save(); render(); },
  skin: d => { const t = getTheme(d.t); if (t.id === state.settings.skin) return; state.settings.skin = t.id; save(); animateNext = true; render(); unlockAudio(); play(t.sound.taken); if (state.settings.onboarded) toast('Look: ' + t.name); },
  dose: d => doseSheet(d.d, d.k),
  take: d => { if (takeDose(d.d, d.k)) { closeSheet(); render(); } },
  skip: d => { if (L.markDose(d.d, d.k, 's')) { save(); reminders.clearDelivered(d.d, d.k); } closeSheet(); render(); },
  undo: d => { if (L.markDose(d.d, d.k, null)) save(); closeSheet(); render(); },
  'onb-next': () => { onbStep = 1; render(); window.scrollTo(0, 0); },
  'onb-accept': () => { if (!$('#onb-ok').checked) { toast('Please tick the box to continue'); return; } onbStep = 2; render(); window.scrollTo(0, 0); },
  'try-sample': () => { state = sampleState(); save(); render(); afterOnboarding(); },
  'start-fresh': () => { const st = state.settings; state = blank(); state.settings = Object.assign(state.settings, { onboarded: true, theme: st.theme, skin: st.skin, sound: st.sound }); who = null; save(); render(); personSheet(); },
  'edit-med': d => medSheet(d.id),
  'edit-person': d => personSheet(d.id),
  'edit-contact': d => contactSheet(d.id),
  'add-time': () => { const box = $('#times'); if (box.children.length >= LIMITS.times) { toast('That is the most times one medicine can have'); return; } box.insertAdjacentHTML('beforeend', timeRow('20:00')); },
  'rm-time': (d, el) => { if ($('#times').children.length > 1) el.closest('.trow').remove(); else toast('Keep at least one time'); },
  'pause-med': d => { const m = med(d.id); if (!m) return; m.active = m.active === false; if (m.active) m.created = Date.now(); save(); closeSheet(); render(); },
  'ask-del-med': d => { const m = med(d.id); if (m) confirmSheet('Delete ' + m.name + '?', 'Its reminders and history will be removed.', 'del-med', d.id, 'Delete medicine'); },
  'del-med': d => { state.meds = state.meds.filter(x => x.id !== d.id); save(); closeSheet(); render(); },
  'ask-del-person': d => { const p = person(d.id); if (p) confirmSheet('Delete ' + p.name + '?', 'Their medicines and history will be removed. Saved records stay.', 'del-person', d.id, 'Delete person'); },
  'del-person': d => { state.people = state.people.filter(x => x.id !== d.id); state.meds = state.meds.filter(x => x.personId !== d.id); save(); closeSheet(); render(); },
  'del-contact': d => { state.contacts = state.contacts.filter(x => x.id !== d.id); save(); closeSheet(); render(); },
  ecard: d => ecardSheet(d.id),
  guardian: d => guardianSheet(d.id),
  ack: d => { if (person(d.id)) { state.settings.ack[d.id] = str(d.sig, 80); save(); } closeSheet(); render(); },
  'copy-guardian': () => copyText($('#g-msg').value, 'Message copied'),
  share: d => shareSheet(d.id),
  'copy-share': () => copyText(shareMsg, 'Message copied'),
  'share-native': () => { try { sharing.image(shareCanvas.toDataURL('image/png'), shareMsg); } catch (e) { toast('Could not open the share menu.'); } },
  'save-card': async () => { if (!store.downloads || !shareCanvas) return; try { const blob = await new Promise(r => shareCanvas.toBlob(r, 'image/png')); await store.downloads.save({ filename: 'dosewell-streak.png', data: blob }); toast('Picture saved'); } catch (e) { if (!e || e.code !== 'declined') toast('Could not save here. Press and hold the picture instead.'); } },
  report: d => { if (person(d.id)) copyText(reportText(d.id), 'Report copied'); },
  'add-rec': recSheet,
  'view-rec': d => { const r = records.find(x => x.id === d.id); if (!r) return; const p = person(r.personId); openSheet(`<h2>${esc(r.title)}</h2><p class="muted small">${esc(r.type)} · ${niceDate(r.date)}${p ? ' · ' + esc(p.name) : ''}</p>${r.note ? `<p>${esc(r.note)}</p>` : ''}<div class="viewer" id="viewer"><img src="${esc(r.img)}" alt="${esc(r.title)}" data-a="zoom"></div><p class="small muted">Tap the picture to zoom.</p><button class="btn wide" data-a="close">Close</button><button class="btn danger wide" data-a="ask-del-rec" data-id="${esc(r.id)}">Delete record</button>`); },
  zoom: () => $('#viewer').classList.toggle('zoom'),
  'ask-del-rec': d => confirmSheet('Delete this record?', 'The photo will be removed for good.', 'del-rec', d.id, 'Delete record'),
  'del-rec': async d => { try { await store.deleteRecord(d.id); records = records.filter(r => r.id !== d.id); } catch (e) { toast('Could not delete. Try again.'); } closeSheet(); render(); },
  privacy: () => openSheet(`<h2>Privacy policy</h2><div class="prose">${PRIVACY}</div><button class="btn wide" data-a="close">Close</button>`),
  disclaimer: () => openSheet(`<h2>Medical disclaimer</h2><div class="prose">${DISCLAIMER}</div><button class="btn wide" data-a="close">Close</button>`),
  'ask-notif': () => { closeSheet(); reminders.ask(); },
  'ask-exact': () => reminders.askExact(),
  'test-alarm': () => { unlockAudio(); const n = new Date(); testAlarm = true; showAlarm([{ med: { id: 'test', personId: '', name: 'Sample medicine', strength: '500 mg', form: 'Tablet', qty: 1, food: 'After food' }, time: pad(n.getHours()) + ':' + pad(n.getMinutes()), key: 'test', date: today() }]); },
  'alarm-take': d => { if (testAlarm) { hideAlarm(); return; } takeDose(d.d, d.k); alarmKeys = ''; tick(); render(); },
  'alarm-snooze': () => { const until = Date.now() + state.settings.snooze * 60000; for (const d of dueList()) silenced[d.date + '|' + d.key] = until; hideAlarm(); toast('Snoozed for ' + state.settings.snooze + ' minutes'); },
  'alarm-close': () => { if (!testAlarm) for (const d of dueList()) silenced[d.date + '|' + d.key] = Infinity; hideAlarm(); },
  export: async () => { try { await sharing.file('dosewell-backup-' + today() + '.json', JSON.stringify({ app: 'dosewell', format: 1, exportedAt: new Date().toISOString(), state, records })); } catch (e) { if (!e || e.code !== 'declined') toast('Could not create the backup file here.'); } },
  'do-import': async () => { const imp = pendingImport; pendingImport = null; if (!imp) return; const old = records.map(r => r.id); state = imp.state; state.settings.onboarded = true; delete state.sample; who = null; save(); await store.clearRecords(old); records = []; for (const r of imp.records) { try { await store.saveRecord(r); records.push(r); } catch (e) { /* skip */ } } closeSheet(); render(); toast('Backup restored'); },
  'ask-reset': () => confirmSheet('Erase everything?', 'All people, medicines, history, contacts and records will be removed for good.', 'reset', '', 'Erase everything'),
  reset: async () => { const old = records.map(r => r.id); state = blank(); records = []; who = null; onbStep = 0; save(); await store.clearRecords(old); reminders.cancelAll(); closeSheet(); location.hash = ''; render(); window.scrollTo(0, 0); }
};
let pendingImport = null;
async function readImport(file) {
  if (!file) return;
  try {
    if (file.size > 150 * 1024 * 1024) throw new Error('big');
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'dosewell' || typeof data.state !== 'object') throw new Error('not a backup');
    const s = sanitizeState(data.state), ids = new Set(s.people.map(p => p.id)), seen = new Set();
    const recs = (Array.isArray(data.records) ? data.records : []).slice(0, LIMITS.records).map(r => sanitizeRecord(r, ids)).filter(r => r && !seen.has(r.id) && seen.add(r.id));
    pendingImport = { state: s, records: recs };
    openSheet(`<h2>Restore this backup?</h2><p class="muted">It has ${s.people.length} people, ${s.meds.length} medicines and ${recs.length} records. It replaces everything in Dosewell now.</p><button class="btn primary wide" data-a="do-import">Replace my data</button><button class="btn quiet wide" data-a="close">Cancel</button>`);
  } catch (e) { toast('That file is not a Dosewell backup.'); }
}
const F = {
  med: (fd, form) => {
    const id = form.dataset.id, times = [...new Set(fd.getAll('time').filter(isTime))].sort();
    let days = [...new Set(fd.getAll('day').map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort(); if (!days.length) days = [0, 1, 2, 3, 4, 5, 6];
    if (!times.length) { toast('Add at least one time'); return; }
    const name = str(fd.get('name'), 60); if (!name) { toast('Enter the medicine name'); return; }
    const start = isDate(fd.get('start')) ? fd.get('start') : today(), end = isDate(fd.get('end')) ? fd.get('end') : '';
    if (end && end < start) { toast('End date is before the start date'); return; }
    if (!person(fd.get('personId'))) { toast('Choose who this is for'); return; }
    const stock = fd.get('stock'), qty = parseFloat(fd.get('qty'));
    const data = { personId: fd.get('personId'), name, strength: str(fd.get('strength'), 30), form: fd.get('form'), qty: qty > 0 ? qty : 1, times, days, food: fd.get('food'), start, end, stock: stock === '' || stock === null ? null : Math.max(0, parseFloat(stock) || 0), notes: str(fd.get('notes'), 160) };
    const m = med(id);
    if (m) { if (m.times.join() !== times.join() || m.days.join() !== days.join() || m.start !== start) data.created = Date.now(); Object.assign(m, data); }
    else state.meds.push(Object.assign({ id: 'm' + uid(), created: Date.now(), active: true }, data));
    save(); closeSheet(); render();
    if (!m && remStatus.supported && !remStatus.allowed && !remStatus.asked) notifPrompt();
  },
  person: (fd, form) => {
    const id = form.dataset.id, data = {}; for (const k of ['name', 'relation', 'blood', 'allergies', 'conditions', 'doctor', 'doctorPhone']) if (fd.has(k)) data[k] = String(fd.get(k) || '');
    if (!str(data.name, 40)) { toast('Enter a name'); return; }
    const p = person(id), first = !state.settings.onboarded;
    if (p) Object.assign(p, data); else state.people.push(Object.assign({ id: 'p' + uid(), color: state.people.length % 6, blood: '', allergies: '', conditions: '', doctor: '', doctorPhone: '' }, data));
    state.settings.onboarded = true; save(); closeSheet(); render();
    if (first) { window.scrollTo(0, 0); afterOnboarding(); }
  },
  contact: (fd, form) => {
    const id = form.dataset.id, data = { name: String(fd.get('name') || ''), relation: String(fd.get('relation') || ''), phone: String(fd.get('phone') || ''), guardian: !!fd.get('guardian') };
    if (!str(data.name, 40) || telHref(data.phone).replace(/\D/g, '').length < 3) { toast('Enter a name and a phone number'); return; }
    const c = state.contacts.find(x => x.id === id);
    if (c) Object.assign(c, data); else state.contacts.push(Object.assign({ id: 'c' + uid() }, data));
    save(); closeSheet(); render();
  },
  rec: async (fd, form) => {
    if (!pendingImg) { toast('Add a photo first'); return; }
    const btn = form.querySelector('.btn.primary'); if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Saving…';
    const rec = sanitizeRecord({ id: 'r' + uid(), title: fd.get('title'), type: fd.get('type'), date: fd.get('date'), personId: fd.get('personId') || '', note: fd.get('note'), img: pendingImg, createdAt: Date.now() }, new Set(state.people.map(p => p.id)));
    if (!rec) { btn.disabled = false; btn.textContent = 'Save record'; toast('That photo could not be saved. Try another.'); return; }
    try { await store.saveRecord(rec); records.push(rec); pendingImg = null; closeSheet(); render(); toast('Record saved'); }
    catch (e) { btn.disabled = false; btn.textContent = 'Save record'; toast(e && (e.code === 'quota_exceeded' || e.name === 'QuotaExceededError') ? 'Storage is full. Delete an old record first.' : 'Could not save. Try again.'); }
  }
};
function afterOnboarding() { if (remStatus.supported && !remStatus.allowed) notifPrompt(); }

document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el) return; const fn = A[el.dataset.a]; if (typeof fn === 'function' && Object.prototype.hasOwnProperty.call(A, el.dataset.a)) { if (el.tagName === 'BUTTON' && el.type !== 'submit') e.preventDefault(); fn(el.dataset, el); } });
document.addEventListener('submit', e => { const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); if (Object.prototype.hasOwnProperty.call(F, f.dataset.form)) F[f.dataset.form](new FormData(f), f); });
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.set && Object.prototype.hasOwnProperty.call(state.settings, el.dataset.set) && el.dataset.set !== 'ack') {
    const k = el.dataset.set; state.settings[k] = el.type === 'checkbox' ? el.checked : k === 'cc' ? el.value : +el.value; save(); if (k === 'sound' && el.checked) unlockAudio(); return;
  }
  if (el.id === 'imp') { const f = el.files && el.files[0]; el.value = ''; readImport(f); return; }
  if (el.id === 'r-cam' || el.id === 'r-gal') {
    const f = el.files && el.files[0]; if (!f) return; const pv = $('#r-prev'); pv.textContent = 'Preparing photo…';
    try { pendingImg = await fileToDataUrl(f); if ($('#r-prev')) $('#r-prev').innerHTML = `<img src="${esc(pendingImg)}" alt="Chosen photo" style="max-width:100%;max-height:220px;border-radius:14px;display:block">`; }
    catch (err) { pendingImg = null; if ($('#r-prev')) $('#r-prev').textContent = 'That file could not be read as a photo. Try another one.'; }
  }
});
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) closeSheet(); });
window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

// Doses marked "Taken" on a notification while the app was closed are applied here.
function applyPending() {
  let n = 0;
  for (const p of reminders.pending()) if (p && isDate(p.d) && typeof p.k === 'string' && /^([01]\d|2[0-3])[0-5]\d$/.test(p.t) && !(state.logs[p.d] || {})[p.k] && L.markDose(p.d, p.k, 't' + p.t)) n++;
  if (n) save();
  return n;
}

/* ============ boot ============ */
async function boot() {
  const cached = store.bootState();
  state = sanitizeState(cached);
  if (state.people.length) state.settings.onboarded = true;
  render();
  const remote = await store.loadState();
  if (remote) { const r = sanitizeState(remote); if (r.people.length) r.settings.onboarded = true; if (!state.people.length || r.updatedAt >= state.updatedAt) state = r; }
  try { records = await store.loadRecords(new Set(state.people.map(p => p.id))); } catch (e) { records = []; }
  remStatus = reminders.status();
  applyPending();
  render(); tick(); setInterval(tick, 15000); syncReminders();
  onAppEvents({
    back: () => { if ($('#alarm').classList.contains('open')) { A['alarm-close'](); return true; } if (sheetOpen()) { closeSheet(); return true; } if (state.settings.onboarded && tab !== 'today') { location.hash = '#today'; return true; } return false; },
    resume: () => { const was = remStatus.allowed, exact = remStatus.exact; remStatus = reminders.status(); applyPending(); if ((!was && remStatus.allowed) || exact !== remStatus.exact) { syncReminders(); if (!was && remStatus.allowed) toast('Reminders are on'); } tick(); if (!sheetOpen()) render(); }
  });
}
boot();
// Test hook: lets the automated suite load hostile data through the same path a backup file takes.
if (typeof window !== 'undefined' && window.__DOSEWELL_TEST__) window.__dosewell = { load: (s, r) => { state = sanitizeState(s); state.settings.onboarded = true; const ids = new Set(state.people.map(p => p.id)); records = (r || []).map(x => sanitizeRecord(x, ids)).filter(Boolean); render(); }, get: () => state, readImport };
