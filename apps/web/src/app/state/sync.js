// Синхронизация «IndexedDB ↔ Supabase».
// Офлайн-первый подход: приложение всегда пишет локально, а этот модуль
// отправляет изменённые записи (upsert) и забирает чужие изменения по updated_at.
// Конфликт одной записи решается так: побеждает более свежая версия.
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { store, idb } from './store.js';

const ts = v => (v ? new Date(v).toISOString() : null);
const ms = v => (v ? new Date(v).getTime() : null);

// Как локальные коллекции ложатся на таблицы
const TABLES = {
  tx: {
    table: 'transactions', conflict: 'id',
    toRow: (t, at) => ({ id: t.id, type: t.type, cat: t.cat, amount: Math.round(t.amount), date: t.date, note: t.note || '', installment_id: t.inst || null, installment_k: t.k ?? null, deposit_id: t.dep || null, created_at: ts(t.createdAt || at), updated_at: ts(at), deleted_at: ts(t.deletedAt) }),
    fromRow: r => ({ id: r.id, type: r.type, cat: r.cat, amount: Number(r.amount), date: r.date, note: r.note || '', ...(r.installment_id ? { inst: r.installment_id, k: r.installment_k } : {}), ...(r.deposit_id ? { dep: r.deposit_id } : {}), createdAt: ms(r.created_at), updatedAt: ms(r.updated_at), deletedAt: ms(r.deleted_at) }),
    soft: true,
  },
  categories: {
    table: 'categories', conflict: 'user_id,id',
    toRow: (c, at, del) => ({ id: c.id, type: c.type, name: c.name, icon: c.icon, color: c.color, sort: c.order ?? 0, archived: !!c.archived, updated_at: ts(at), deleted_at: del ? ts(at) : null }),
    fromRow: r => ({ id: r.id, type: r.type, name: r.name, icon: r.icon, color: r.color, order: r.sort, archived: r.archived }),
  },
  challenges: {
    table: 'challenges', conflict: 'id',
    toRow: (c, at, del) => ({ id: c.id, cat: c.cat, limit_amount: Math.round(c.limit), created_at: ts(c.createdAt || at), updated_at: ts(at), deleted_at: del ? ts(at) : null }),
    fromRow: r => ({ id: r.id, cat: r.cat, limit: Number(r.limit_amount), createdAt: ms(r.created_at) }),
  },
  installments: {
    table: 'installments', conflict: 'id',
    toRow: (i, at, del) => ({ id: i.id, name: i.name, total: Math.round(i.total), months: i.months, first_date: i.first, paid_before: i.paidBefore || 0, created_at: ts(i.createdAt || at), updated_at: ts(at), deleted_at: del ? ts(at) : null }),
    fromRow: r => ({ id: r.id, name: r.name, total: Number(r.total), months: r.months, first: r.first_date, paidBefore: r.paid_before, createdAt: ms(r.created_at) }),
  },
  deposits: {
    table: 'deposits', conflict: 'id',
    toRow: (d, at, del) => ({ id: d.id, name: d.name, rate: d.rate, term: d.term, cap: !!d.cap, start_date: d.start, closed_at: ts(d.closedAt), created_at: ts(d.createdAt || at), updated_at: ts(at), deleted_at: del ? ts(at) : null }),
    fromRow: r => ({ id: r.id, name: r.name, rate: Number(r.rate), term: r.term, cap: r.cap, start: r.start_date, closedAt: ms(r.closed_at), createdAt: ms(r.created_at) }),
  },
};
const PROFILE_KEYS = ['profile', 'settings', 'meta'];

// Очередь неотправленного: { tx: { id: время изменения }, …, profile: время } + курсоры чтения
let q = { dirty: {}, removed: {}, profileAt: 0, cursors: {}, profilePulledAt: null };
const emptyQueue = () => ({ dirty: {}, removed: {}, profileAt: 0, cursors: {}, profilePulledAt: null });
const saveQueue = () => idb.save('sync', q).catch(() => {});

export const syncState = { status: 'off', lastAt: null, error: null, subs: new Set() };
const setStatus = (status, error = null) => {
  syncState.status = status; syncState.error = error;
  if (status === 'idle') syncState.lastAt = Date.now();
  syncState.subs.forEach(f => f());
};

let userId = null, running = false, again = false, pushT = 0, timer = 0, tracking = false;

/** Вызывается один раз при запуске: поднимает очередь и начинает следить за изменениями. */
export async function initSync() {
  const saved = idb.db ? await idb.load('sync').catch(() => null) : null;
  if (saved) q = saved;
  if (!tracking) { store.onChange(track); tracking = true; }
}

/** Отмечает изменённые записи, сравнивая состояние до и после. */
function track(prev, next) {
  const now = Date.now();
  for (const key of Object.keys(TABLES)) {
    if (prev[key] === next[key]) continue;
    const before = new Map((prev[key] || []).map(r => [r.id, r]));
    const d = (q.dirty[key] ||= {}), rm = (q.removed[key] ||= {});
    for (const r of next[key] || []) { if (before.get(r.id) !== r) { d[r.id] = now; delete rm[r.id]; } before.delete(r.id); }
    for (const [id, r] of before) { rm[id] = { row: r, at: now }; delete d[id]; }
  }
  if (PROFILE_KEYS.some(k => prev[k] !== next[k])) q.profileAt = now;
  saveQueue();
  if (userId) { clearTimeout(pushT); pushT = setTimeout(() => run(), config.pushDebounceMs); }
}

async function push() {
  for (const [key, spec] of Object.entries(TABLES)) {
    const d = q.dirty[key] || {}, rm = q.removed[key] || {};
    const local = new Map((store.s[key] || []).map(r => [r.id, r]));
    const rows = [];
    for (const [id, at] of Object.entries(d)) { const r = local.get(id); if (r) rows.push({ ...spec.toRow(r, at, false), user_id: userId }); }
    for (const [, { row, at }] of Object.entries(rm)) rows.push({ ...spec.toRow(row, at, true), user_id: userId });
    if (!rows.length) continue;
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(spec.table).upsert(rows.slice(i, i + 500), { onConflict: spec.conflict });
      if (error) throw error;
    }
    // снимаем из очереди только то, что не менялось, пока шёл запрос
    for (const r of rows) { if (d[r.id] && ms(r.updated_at) === d[r.id]) delete d[r.id]; if (rm[r.id] && ms(r.updated_at) === rm[r.id].at) delete rm[r.id]; }
  }
  if (q.profileAt) {
    const at = q.profileAt, s = store.s;
    const { error } = await supabase.from('profiles').upsert({ user_id: userId, name: s.profile.name, color: s.profile.color, showcase: s.profile.showcase || [], settings: s.settings, meta: { ...s.meta, demo: false }, updated_at: ts(at) }, { onConflict: 'user_id' });
    if (error) throw error;
    if (q.profileAt === at) q.profileAt = 0;
  }
  saveQueue();
}

async function pull() {
  const patch = {};
  for (const [key, spec] of Object.entries(TABLES)) {
    let query = supabase.from(spec.table).select('*').order('updated_at', { ascending: true }).limit(5000);
    if (q.cursors[key]) query = query.gt('updated_at', q.cursors[key]);
    const { data, error } = await query;
    if (error) throw error;
    if (!data.length) continue;
    const list = [...(patch[key] || store.s[key] || [])];
    const idx = new Map(list.map((r, i) => [r.id, i]));
    for (const row of data) {
      const localAt = (q.dirty[key] || {})[row.id] || (q.removed[key] || {})[row.id]?.at;
      if (localAt && localAt > ms(row.updated_at)) continue; // локальная правка свежее — отправим её
      delete (q.dirty[key] || {})[row.id];
      const gone = row.deleted_at && !spec.soft;
      const i = idx.get(row.id);
      if (gone) { if (i != null) { list[i] = null; } continue; }
      const obj = spec.fromRow(row);
      if (i != null) list[i] = obj; else { idx.set(row.id, list.length); list.push(obj); }
    }
    patch[key] = list.filter(Boolean);
    q.cursors[key] = data[data.length - 1].updated_at;
  }
  const { data: prof, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  if (prof && prof.updated_at !== q.profilePulledAt && !(q.profileAt && q.profileAt > ms(prof.updated_at))) {
    const s = store.s;
    // награды не теряем: берём максимум с обеих сторон
    const ach = { ...(prof.meta?.ach || {}) };
    for (const [id, v] of Object.entries(s.meta.ach || {})) { const r = ach[id]; ach[id] = !r ? v : { tier: Math.max(r.tier || 0, v.tier || 0), count: Math.max(r.count || 0, v.count || 0), at: Math.min(r.at || Infinity, v.at || Infinity) }; }
    patch.profile = { ...s.profile, name: prof.name ?? s.profile.name, color: prof.color ?? s.profile.color, showcase: prof.showcase ?? s.profile.showcase };
    patch.settings = { ...s.settings, ...(prof.settings || {}) };
    patch.meta = { ...s.meta, ...(prof.meta || {}), ach, onboarded: true, demo: false };
    q.profilePulledAt = prof.updated_at;
  }
  if (Object.keys(patch).length) store.set(patch, { fromSync: true });
  saveQueue();
}

async function run() {
  if (!userId || !supabase) return;
  if (running) { again = true; return; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { setStatus('offline'); return; }
  running = true; setStatus('syncing');
  try { await push(); await pull(); setStatus('idle'); }
  catch (e) { console.warn('[sync]', e); setStatus('error', e.message || String(e)); }
  finally { running = false; if (again) { again = false; run(); } }
}

/**
 * Запуск после входа.
 * mode: 'merge' — отправить всё, что есть на устройстве; 'replace' — забыть локальное и взять из аккаунта.
 */
export async function startSync(uid, { mode = 'merge', emptyState } = {}) {
  if (!supabase) return;
  if (userId === uid) { run(); return; }
  stopSync();
  if (!tracking) await initSync();
  const known = q.userId === uid;
  userId = uid;
  if (!known) {
    q = { ...emptyQueue(), userId: uid };
    if (mode === 'replace' && emptyState) store.set({ ...emptyState(), meta: { ...emptyState().meta, onboarded: true } }, { fromSync: true });
    else {
      const now = Date.now();
      for (const key of Object.keys(TABLES)) { q.dirty[key] = Object.fromEntries((store.s[key] || []).map(r => [r.id, now])); }
      q.profileAt = now;
    }
  }
  q.userId = uid; saveQueue();
  const wake = () => run();
  addEventListener('online', wake); addEventListener('focus', wake);
  document.addEventListener('visibilitychange', wake);
  timer = setInterval(wake, config.syncIntervalMs);
  stopSync.cleanup = () => { removeEventListener('online', wake); removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  await run();
}

export function stopSync() {
  userId = null;
  clearInterval(timer); clearTimeout(pushT);
  stopSync.cleanup && stopSync.cleanup();
  setStatus('off');
}

export const syncNow = () => run();
/** Есть изменения, которые ещё не дошли до сервера. */
export const hasPending = () => q.profileAt > 0 || [q.dirty, q.removed].some(m => Object.values(m).some(o => Object.keys(o).length));
/** Перезаписать очередь на диске (после включения или выключения шифрования). */
export const flushQueue = () => saveQueue();
