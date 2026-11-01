import { html } from 'htm/preact';
import { useState, useMemo } from 'preact/hooks';
import { Icon, SheetNav } from '@grosh/ui-kit';
import { TODAY, dateLong, plural } from '../lib/dates.js';
import { SCHEMA, mutate, store, ui } from '../state/store.js';
import { backupJSON, download, markBackup } from '../lib/backup.js';

export function BackupSheet({ close }) {
  const s = store.s;
  const json = useMemo(() => backupJSON(s), []);
  const kb = Math.max(1, Math.round(new Blob([json]).size / 1024));
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(json).then(() => { setCopied(true); markBackup(); ui.toast('JSON скопирован'); }).catch(() => ui.toast('Не получилось скопировать. Выделите текст вручную.', null, 'error')); };
  return html`<${SheetNav} title="Бэкап" onCancel=${close} cancel="Закрыть" />
    <div class="sheet__body">
      <div class="group">
        <div class="cell"><span class="cell__main">Файл</span><span class="cell__value">grosh-${TODAY}.json</span></div>
        <div class="cell"><span class="cell__main">Размер</span><span class="cell__value">${kb} КБ · ${s.tx.filter(t => !t.deletedAt).length} записей</span></div>
      </div>
      <div class="code">${json.slice(0, 900)}…</div>
      <button class="btn btn--filled" onClick=${() => { download(`grosh-${TODAY}.json`, json, 'application/json'); markBackup(); close(); ui.toast('Бэкап сохранён'); }}><${Icon} n="download" />Скачать файл</button>
      <button class="btn" onClick=${copy}><${Icon} n=${copied ? 'check' : 'content_copy'} />${copied ? 'Скопировано' : 'Скопировать JSON'}</button>
      <div class="section__footer" style="padding:0 16px">Если скачивание не началось (в окне предпросмотра оно может быть заблокировано), скопируйте JSON и сохраните в файл.</div>
    </div>`;
}
export function ImportSheet({ data, close }) {
  const n = data.tx.filter(t => !t.deletedAt).length;
  const apply = mode => {
    close();
    if (mode === 'replace') store.set({ ...data, v: SCHEMA, meta: { ...data.meta } });
    else store.set(st => { const m = new Map(st.tx.map(t => [t.id, t])); data.tx.forEach(t => { const o = m.get(t.id); if (!o || (t.updatedAt || 0) > (o.updatedAt || 0)) m.set(t.id, t); }); const cats = [...st.categories]; data.categories.forEach(c => { if (!cats.some(x => x.id === c.id)) cats.push(c); }); return { tx: [...m.values()], categories: cats }; });
    mutate(() => ({}));
    ui.toast(mode === 'replace' ? `Загружено ${n} ${plural(n, 'запись', 'записи', 'записей')}` : 'Бэкап объединён с текущими данными');
  };
  return html`<${SheetNav} title="Загрузить бэкап" onCancel=${close} />
    <div class="sheet__body">
      <div class="group"><div class="cell"><span class="cell__main">${n} ${plural(n, 'запись', 'записи', 'записей')}</span><span class="cell__value">${data.exportedAt ? dateLong(data.exportedAt.slice(0, 10)) : ''}</span></div></div>
      <button class="btn btn--filled" onClick=${() => apply('merge')}>Объединить с текущими</button>
      <button class="btn btn--destructive" onClick=${() => apply('replace')}>Заменить всё</button>
      <div class="section__footer" style="padding:0 16px">При объединении из двух версий одной записи остаётся более свежая.</div>
    </div>`;
}
