import { useState, useEffect } from 'preact/hooks';
import { haptic } from '@grosh/ui-kit';
import { money, uid } from '../lib/dates.js';
import { ACH, evaluate } from '../lib/achievements.js';
import { isSealed, seal, unseal } from '../lib/vault.js';

export const SCHEMA = 3;

// Локальная копия всех данных — одна запись в IndexedDB. Работает офлайн; сервер её только синхронизирует.
export const idb = {
  db: null,
  dek: null, // ключ данных, пока приложение разблокировано (см. lock.js)
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open('grosh', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { this.db = r.result; res(); }; r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  get(k) { return new Promise((res, rej) => { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  put(k, v) { return new Promise((res, rej) => { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  del(k) { return new Promise((res, rej) => { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  // данные с шифрованием, если включён код-пароль
  async load(k) {
    const v = await this.get(k);
    if (!isSealed(v)) return v;
    if (!this.dek) throw new Error('locked');
    return unseal(this.dek, v);
  },
  async save(k, v) { if (this.db) await this.put(k, this.dek ? await seal(this.dek, v) : v); },
};

const changeListeners = new Set();
export const store = {
  s: null, subs: new Set(), saveT: 0,
  /** fromSync: изменение пришло с сервера — не отправлять его обратно. */
  set(patch, { fromSync = false } = {}) {
    const prev = this.s;
    this.s = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
    if (!fromSync) changeListeners.forEach(f => f(prev, this.s));
    this.subs.forEach(f => f());
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => this.flush(), 250);
  },
  flush() { clearTimeout(this.saveT); return idb.save('state', this.s).catch(() => {}); },
  onChange(f) { changeListeners.add(f); return () => changeListeners.delete(f); },
};
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); store.subs.add(f); return () => store.subs.delete(f); }, []);
  return store.s;
}

// Императивные действия интерфейса (шторка, тост, диалог…). Заполняет AppProvider.
export const ui = {};
export const buzz = haptic;
export const catOf = id => store.s.categories.find(c => c.id === id) || { name: 'Без категории', icon: 'help', color: 'gray' };

// любое изменение данных проходит здесь — после него проверяем ачивки
export function mutate(fn) {
  store.set(fn);
  const { res } = evaluate(store.s);
  const prev = store.s.meta.ach, next = { ...prev }, fresh = [];
  for (const a of ACH) {
    const r = res[a.id], p = prev[a.id] || { tier: 0, count: 0 };
    const up = a.monthly ? r.count > (p.count || 0) : r.tier > (p.tier || 0);
    if (up) { fresh.push(a.id); next[a.id] = { tier: r.tier, count: r.count || 0, at: Date.now() }; }
  }
  if (fresh.length) { store.set(s => ({ meta: { ...s.meta, ach: next } })); ui.unlock && ui.unlock(fresh); }
}
export const addTx = t => { const now = Date.now(); mutate(s => ({ tx: [...s.tx, { ...t, id: uid(), createdAt: now, updatedAt: now, deletedAt: null }] })); };
export const updTx = (id, patch) => mutate(s => ({ tx: s.tx.map(t => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)) }));
export const delTx = t => {
  updTx(t.id, { deletedAt: Date.now() });
  buzz([6, 40, 6]);
  ui.toast(`Удалено: ${catOf(t.cat).name}, ${money(t.amount)}`, { label: 'Вернуть', run: () => updTx(t.id, { deletedAt: null }) }, 'delete');
};
