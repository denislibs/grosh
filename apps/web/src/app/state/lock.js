import { useState, useEffect } from 'preact/hooks';
import { createVault, unlockWithPin, changePin, addBio, unlockWithBio } from '../lib/vault.js';
import { bioCreate, bioSecret } from '../lib/biometric.js';
import { idb, store } from './store.js';
import { flushQueue } from './sync.js';

// Код-пароль и Face ID. Описание хранилища (соль, зашифрованные копии ключа) лежит в IndexedDB открыто,
// ключ данных — только в памяти, пока приложение разблокировано.
const FAILS = 'grosh.lock.fails', UNTIL = 'grosh.lock.until';
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} },
};

export const lock = {
  meta: null,
  subs: new Set(),
  emit() { this.subs.forEach(f => f()); },
  async init() { this.meta = idb.db ? (await idb.get('vault').catch(() => null)) || null : null; },
  get on() { return !!this.meta; },
  get bio() { return !!this.meta?.bio; },

  /** Сколько миллисекунд ждать после серии неверных кодов. */
  waitLeft() { return Math.max(0, +(ls.get(UNTIL) || 0) - Date.now()); },
  fails() { return +(ls.get(FAILS) || 0); },
  ok() { ls.del(FAILS); ls.del(UNTIL); },
  fail() {
    const n = this.fails() + 1;
    ls.set(FAILS, n);
    if (n >= 5) ls.set(UNTIL, Date.now() + 30_000 * 2 ** (n - 5)); // 30 с, 1 мин, 2 мин…
  },

  /** Проверяет код; при успехе ключ данных остаётся в памяти. */
  async unlockPin(pin) {
    if (this.waitLeft()) return false;
    const dek = await unlockWithPin(this.meta, pin);
    if (!dek) { this.fail(); return false; }
    this.ok(); idb.dek = dek; return true;
  },
  async unlockBio() {
    const secret = await bioSecret(this.meta.bio.credId, this.meta.bio.salt);
    idb.dek = await unlockWithBio(this.meta, secret);
    this.ok(); return true;
  },

  // хранилище записываем раньше данных: если вкладку закроют посередине, данные останутся читаемыми
  async persist() { await store.flush(); await flushQueue(); },
  async writeMeta(meta) { this.meta = meta; await idb.put('vault', meta); this.emit(); },

  async enable(pin) {
    const { dek, meta } = await createVault(pin);
    await this.writeMeta(meta);
    idb.dek = dek; this.ok();
    await this.persist();
  },
  async changePin(pin) { await this.writeMeta(await changePin(this.meta, idb.dek, pin)); },
  async disable() {
    idb.dek = null;
    await this.persist();
    this.meta = null; await idb.del('vault'); this.ok(); this.emit();
  },
  async enableBio() { await this.writeMeta(await addBio(this.meta, idb.dek, await bioCreate())); },
  async disableBio() { await this.writeMeta({ ...this.meta, bio: null }); },

  /** Стирает всё с устройства: хранилище, данные и очередь синхронизации. Больше ничего не записываем. */
  async wipe() {
    clearTimeout(store.saveT);
    if (idb.db) await Promise.all(['vault', 'state', 'sync'].map(k => idb.del(k).catch(() => {})));
    idb.db = null; idb.dek = null; this.meta = null; this.ok();
  },
};

export function useLock() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); lock.subs.add(f); return () => lock.subs.delete(f); }, []);
  return lock;
}
