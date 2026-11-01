import { dateLong, plural } from './dates.js';
import { SCHEMA, mutate, store, ui } from '../state/store.js';

export const download = (name, text, type) => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); } catch (e) {} };
export const backupJSON = s => JSON.stringify({ app: 'grosh', v: s.v, exportedAt: new Date().toISOString(), profile: s.profile, settings: s.settings, categories: s.categories, challenges: s.challenges, tx: s.tx, meta: { ...s.meta } }, null, 2);
export const markBackup = () => mutate(st => ({ meta: { ...st.meta, backups: (st.meta.backups || 0) + 1, lastBackupAt: Date.now() } }));
export function askImport(data) {
  const n = data.tx.filter(t => !t.deletedAt).length;
  const apply = mode => {
    if (mode === 'replace') store.set({ ...data, v: SCHEMA, meta: { ...data.meta, onboarded: true } });
    else store.set(st => { const m = new Map(st.tx.map(t => [t.id, t])); data.tx.forEach(t => { const o = m.get(t.id); if (!o || (t.updatedAt || 0) > (o.updatedAt || 0)) m.set(t.id, t); }); const cats = [...st.categories]; data.categories.forEach(c => { if (!cats.some(x => x.id === c.id)) cats.push(c); }); return { tx: [...m.values()], categories: cats }; });
    mutate(() => ({}));
    ui.toast(mode === 'replace' ? `Загружено ${n} ${plural(n, 'запись', 'записи', 'записей')}` : 'Бэкап объединён с текущими данными');
  };
  ui.dialog({ type: 'actions', title: `Бэкап${data.exportedAt ? ' от ' + dateLong(data.exportedAt.slice(0, 10)) : ''}`, msg: `${n} ${plural(n, 'запись', 'записи', 'записей')}. При объединении из двух версий записи остаётся более свежая.`,
    actions: [{ label: 'Объединить с текущими', run: () => apply('merge') }, { label: 'Заменить всё', style: 'destructive', run: () => apply('replace') }] });
}
