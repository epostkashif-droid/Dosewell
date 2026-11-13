// Platform adapters: Android (Capacitor) when installed as an app, browser otherwise.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { App as CapApp } from '@capacitor/app';
import { at, fmtTime, notifId, sanitizeRecord } from './logic.js';

export const native = Capacitor.isNativePlatform();
// An Android WebView without the native bridge means reminders cannot be scheduled.
export const bridgeMissing = !native && /; wv\)/.test(navigator.userAgent) && location.hostname === 'localhost';

const LS = 'dosewell_state_v2', LSR = 'dosewell_records_v2';
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

/* ---------- records in IndexedDB ---------- */
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

/* ---------- storage facade ---------- */
export const store = {
  cloud: null, // set when the Claude-hosted preview gives a private per-person space
  synced: false,
  downloads: null,
  bootState() { return lsGet(LS); },
  async loadState() {
    if (native) { try { const { value } = await Preferences.get({ key: LS }); return value ? JSON.parse(value) : null; } catch (e) { return null; } }
    if (window.claude && window.claude.use) {
      try {
        const [user, db, dl] = await Promise.all([window.claude.use('user'), window.claude.use('db'), window.claude.use('downloads')]);
        this.downloads = dl;
        if (user && db) {
          const id = await user.id();
          if (id) {
            this.cloud = db.collection('data/users/' + id);
            const snap = await this.cloud.doc('state').get();
            this.synced = true;
            if (snap.exists) { try { return JSON.parse(snap.data().json); } catch (e) { return null; } }
          }
        }
      } catch (e) { /* stay local */ }
    }
    return null;
  },
  saving: false, dirty: null,
  async saveState(state) {
    lsSet(LS, state);
    this.dirty = JSON.stringify(state);
    if (this.saving) return;
    this.saving = true;
    while (this.dirty) {
      const json = this.dirty; this.dirty = null;
      try {
        if (native) await Preferences.set({ key: LS, value: json });
        else if (this.cloud) { await this.cloud.doc('state').set({ kind: 'state', updatedAt: state.updatedAt, json }); this.synced = true; }
      } catch (e) { this.synced = false; }
    }
    this.saving = false;
  },
  async loadRecords(personIds) {
    let raw = [];
    try {
      if (this.cloud) { const q = await this.cloud.where('kind', '==', 'record').get(); raw = q.docs.map(d => Object.assign({}, d.data())); }
      else raw = await tx('readonly', s => s.getAll());
    } catch (e) { raw = lsGet(LSR) || []; }
    return (raw || []).map(r => sanitizeRecord(r, personIds)).filter(Boolean);
  },
  async saveRecord(rec) {
    if (this.cloud) return this.cloud.doc('rec_' + rec.id).set(Object.assign({ kind: 'record' }, rec));
    return tx('readwrite', s => s.put(rec));
  },
  async deleteRecord(id) {
    if (this.cloud) return this.cloud.doc('rec_' + id).delete();
    return tx('readwrite', s => s.delete(id));
  },
  async clearRecords(ids) { for (const id of ids) { try { await this.deleteRecord(id); } catch (e) { /* keep going */ } } }
};

/* ---------- reminders ---------- */
const CHANNEL = 'dose_reminders';
let notifReady = false;
export const reminders = {
  async status() {
    if (!native) return { supported: false };
    try {
      const p = await LocalNotifications.checkPermissions();
      let exact = 'granted';
      try { exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm; } catch (e) { /* older Android */ }
      return { supported: true, allowed: p.display === 'granted', asked: p.display !== 'prompt' && p.display !== 'prompt-with-rationale', exact: exact === 'granted' };
    } catch (e) { return { supported: true, allowed: false, asked: false, exact: false }; }
  },
  async ask() { if (!native) return false; try { return (await LocalNotifications.requestPermissions()).display === 'granted'; } catch (e) { return false; } },
  async askExact() { if (!native) return false; try { return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted'; } catch (e) { return false; } },
  async init(onAction) {
    if (!native || notifReady) return;
    notifReady = true;
    try {
      await LocalNotifications.createChannel({ id: CHANNEL, name: 'Medicine reminders', description: 'Alerts when a dose is due', importance: 5, visibility: 0, vibration: true, lights: true });
      await LocalNotifications.registerActionTypes({ types: [{ id: 'DOSE', actions: [{ id: 'taken', title: 'Taken' }, { id: 'snooze', title: 'Snooze' }] }] });
      await LocalNotifications.addListener('localNotificationActionPerformed', a => { try { onAction(a.actionId, (a.notification && a.notification.extra) || {}); } catch (e) { /* ignore */ } });
    } catch (e) { /* reminders stay off */ }
  },
  // Replace every pending reminder with the next few days of doses. Capped well under Android's alarm limit.
  async sync(doses, people, settings) {
    if (!native) return;
    const st = await this.status();
    if (!st.allowed) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      const list = [], now = Date.now();
      for (const d of doses) {
        if (list.length >= 120) break;
        const p = people.find(x => x.id === d.med.personId), when = at(d.date, d.time);
        const who = p ? p.name : '', extra = { d: d.date, k: d.key };
        const name = settings.discreet ? 'a medicine' : d.med.name + (d.med.strength ? ' ' + d.med.strength : '');
        const body = [who, fmtTime(d.time), !settings.discreet && d.med.food !== 'Any time' ? d.med.food.toLowerCase() : ''].filter(Boolean).join(' · ');
        const base = { channelId: CHANNEL, actionTypeId: 'DOSE', extra, autoCancel: true, foreground: true, isExactNotification: st.exact };
        list.push(Object.assign({ id: notifId(d.date + d.key + 'a'), title: 'Time for ' + name, body, schedule: { at: new Date(when), allowWhileIdle: true } }, base));
        if (settings.followUp && when + 45 * 60000 > now) list.push(Object.assign({ id: notifId(d.date + d.key + 'b'), title: 'Not marked yet: ' + name, body: body + ' · tap to mark it', schedule: { at: new Date(when + 45 * 60000), allowWhileIdle: true } }, base));
      }
      if (list.length) await LocalNotifications.schedule({ notifications: list });
    } catch (e) { /* try again on next change */ }
  },
  async snooze(extra, title, minutes) {
    if (!native) return;
    try { await LocalNotifications.schedule({ notifications: [{ id: notifId(extra.d + extra.k + 's' + Date.now()), title, body: 'Snoozed reminder', channelId: CHANNEL, actionTypeId: 'DOSE', extra, schedule: { at: new Date(Date.now() + minutes * 60000), allowWhileIdle: true }, isExactNotification: false }] }); } catch (e) { /* ignore */ }
  },
  async clearDelivered(date, key) {
    if (!native) return;
    try { await LocalNotifications.removeDeliveredNotificationsById({ ids: [notifId(date + key + 'a'), notifId(date + key + 'b')] }); } catch (e) { /* ignore */ }
  },
  async cancelAll() { if (!native) return; try { const p = await LocalNotifications.getPending(); if (p.notifications.length) await LocalNotifications.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) }); } catch (e) { /* ignore */ } }
};

/* ---------- sharing and files ---------- */
export const sharing = {
  canShareFiles: native,
  async image(dataUrl, text) {
    const w = await Filesystem.writeFile({ path: 'dosewell-streak.png', data: dataUrl.split(',')[1], directory: Directory.Cache });
    await Share.share({ title: 'Dosewell', text, files: [w.uri], dialogTitle: 'Share with family' });
  },
  async text(text) { await Share.share({ text, dialogTitle: 'Share' }); },
  async file(name, text) {
    if (native) {
      const w = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: name, files: [w.uri], dialogTitle: 'Save your backup' });
      return true;
    }
    if (store.downloads) { await store.downloads.save({ filename: name, data: text }); return true; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return true;
  }
};

export function onAppEvents({ back, resume }) {
  if (!native) return;
  try { CapApp.addListener('backButton', () => { if (!back()) CapApp.minimizeApp(); }); CapApp.addListener('resume', resume); } catch (e) { /* ignore */ }
}
