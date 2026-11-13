// Platform adapters: the Android app (through the DosewellNative bridge) or a plain browser.
import { at, fmtTime, notifId, sanitizeRecord } from './logic.js';

const N = typeof window !== 'undefined' ? window.DosewellNative : null;
export const native = !!N;

const LS = 'dosewell_state_v2', LSR = 'dosewell_records_v2';
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
const pause = () => new Promise(r => setTimeout(r, 0));

/* ---------- browser records in IndexedDB ---------- */
let idb = null;
function openIdb() {
  if (idb) return idb;
  idb = new Promise((res, rej) => {
    try {
      const rq = indexedDB.open('dosewell', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('records', { keyPath: 'id' });
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    } catch (e) { rej(e); }
  });
  idb.catch(() => { idb = null; });
  return idb;
}
const tx = async (mode, fn) => { const db = await openIdb(); return new Promise((res, rej) => { const t = db.transaction('records', mode); const r = fn(t.objectStore('records')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };

/* ---------- storage ---------- */
export const store = {
  cloud: null, // set when the Claude-hosted preview gives a private per-person space
  synced: false,
  downloads: null,
  bootState() {
    if (native) { try { const s = N.loadState(); if (s) return JSON.parse(s); } catch (e) { /* fall through */ } }
    return lsGet(LS);
  },
  async loadState() {
    if (native || !(window.claude && window.claude.use)) return null;
    try {
      const [user, db, dl] = await Promise.all([window.claude.use('user'), window.claude.use('db'), window.claude.use('downloads')]);
      this.downloads = dl;
      if (user && db) {
        const id = await user.id();
        if (id) {
          this.cloud = db.collection('data/users/' + id);
          const snap = await this.cloud.doc('state').get();
          this.synced = true;
          if (snap.exists) return parse(snap.data().json, null);
        }
      }
    } catch (e) { /* stay local */ }
    return null;
  },
  saving: false, dirty: null,
  async saveState(state) {
    lsSet(LS, state);
    const json = JSON.stringify(state);
    if (native) { try { N.saveState(json); } catch (e) { /* localStorage copy remains */ } return; }
    this.dirty = { json, updatedAt: state.updatedAt };
    if (this.saving || !this.cloud) return;
    this.saving = true;
    while (this.dirty) {
      const d = this.dirty; this.dirty = null;
      try { await this.cloud.doc('state').set({ kind: 'state', updatedAt: d.updatedAt, json: d.json }); this.synced = true; } catch (e) { this.synced = false; }
    }
    this.saving = false;
  },
  async loadRecords(personIds) {
    let raw = [];
    try {
      if (native) { for (const id of parse(N.recordIds(), [])) { const r = parse(N.readRecord(String(id)), null); if (r) raw.push(r); await pause(); } }
      else if (this.cloud) { const q = await this.cloud.where('kind', '==', 'record').get(); raw = q.docs.map(d => Object.assign({}, d.data())); }
      else raw = await tx('readonly', s => s.getAll());
    } catch (e) { raw = raw.length ? raw : (lsGet(LSR) || []); }
    return (raw || []).map(r => sanitizeRecord(r, personIds)).filter(Boolean);
  },
  async saveRecord(rec) {
    if (native) { if (!N.writeRecord(rec.id, JSON.stringify(rec))) throw new Error('write failed'); return; }
    if (this.cloud) return this.cloud.doc('rec_' + rec.id).set(Object.assign({ kind: 'record' }, rec));
    return tx('readwrite', s => s.put(rec));
  },
  async deleteRecord(id) {
    if (native) { N.deleteRecord(id); return; }
    if (this.cloud) return this.cloud.doc('rec_' + id).delete();
    return tx('readwrite', s => s.delete(id));
  },
  async clearRecords(ids) { for (const id of ids) { try { await this.deleteRecord(id); } catch (e) { /* keep going */ } } }
};

/* ---------- reminders ---------- */
export const HORIZON_DAYS = 30;
export const reminders = {
  status() { if (!native) return { supported: false }; return Object.assign({ supported: true, allowed: false, asked: false, exact: false }, parse(N.status(), {})); },
  ask() { if (native) N.askNotif(); },
  askExact() { if (native) N.askExact(); },
  // Doses marked "Taken" from a notification while the app was closed.
  pending() { if (!native) return []; const a = parse(N.takePending(), []); return Array.isArray(a) ? a : []; },
  // Builds the list the phone will fire, soonest first. Kept apart from the bridge so it can be tested.
  plan(doses, people, settings) {
    const list = [];
    for (const d of doses) {
      if (list.length >= 400) break;
      const p = people.find(x => x.id === d.med.personId);
      const name = settings.discreet ? 'a medicine' : d.med.name + (d.med.strength ? ' ' + d.med.strength : '');
      const body = [p ? p.name : '', fmtTime(d.time), !settings.discreet && d.med.food !== 'Any time' ? d.med.food.toLowerCase() : ''].filter(Boolean).join(' · ');
      list.push({ id: notifId(d.date + d.key), at: at(d.date, d.time), title: 'Time for ' + name, body, d: d.date, k: d.key, fu: settings.followUp ? 45 : 0, futitle: 'Not marked yet: ' + name });
    }
    if (list.length) list.push({ id: notifId('keep-going'), at: list[list.length - 1].at + 3600000, title: 'Open Dosewell to keep reminders going', body: 'Reminders are planned ' + HORIZON_DAYS + ' days ahead. Open the app to plan the next ones.', d: '', k: '', fu: 0, plain: true });
    return list;
  },
  sync(doses, people, settings) {
    if (!native) return;
    try { N.setSnooze(settings.snooze); N.schedule(JSON.stringify(this.plan(doses, people, settings))); } catch (e) { /* try again on next change */ }
  },
  clearDelivered(date, key) { if (native) { try { N.clearDelivered(notifId(date + key)); } catch (e) { /* ignore */ } } },
  cancelAll() { if (native) { try { N.cancelAll(); } catch (e) { /* ignore */ } } }
};

/* ---------- sharing, clipboard, system bars ---------- */
export const sharing = {
  canShareFiles: native,
  image(dataUrl, text) { N.shareImage(dataUrl.split(',')[1], text); },
  async file(name, text) {
    if (native) { N.shareFile(name, text); return true; }
    if (store.downloads) { await store.downloads.save({ filename: name, data: text }); return true; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return true;
  }
};
export function clip(text) { if (!native) return false; try { N.copy(text); return true; } catch (e) { return false; } }
export function setBars(dark) { if (native) { try { N.bars(!!dark); } catch (e) { /* ignore */ } } }
export function onAppEvents({ back, resume }) { window.__dwBack = back; window.__dwResume = resume; }
