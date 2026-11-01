import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';
import { Icon, Sq, Chevron, Switch, Page, Select } from '@grosh/ui-kit';
import { TODAY, dateLong, initials, iso } from '../lib/dates.js';
import { catOf, mutate, store, ui } from '../state/store.js';
import { askImport, download } from '../lib/backup.js';
import { makeDemo } from '../lib/seed.js';
import { supabase } from '../lib/supabase.js';
import { syncNow } from '../state/sync.js';
import { useApp } from '../state/AppContext.js';

export function Settings({ s, onClose }) {
  const set = patch => store.set(st => ({ settings: { ...st.settings, ...patch } }));
  const fileRef = useRef();
  const onFile = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const data = JSON.parse(r.result); if (data.app !== 'grosh' || !Array.isArray(data.tx)) throw 0; askImport(data); } catch (err) { ui.toast('Это не бэкап Гроша. Выберите файл из «Скачать бэкап».', null, 'error'); } };
    r.readAsText(f);
  };
  const csv = () => {
    const rows = [['Дата', 'Тип', 'Категория', 'Сумма', 'Заметка'], ...s.tx.filter(t => !t.deletedAt).sort((a, b) => a.date.localeCompare(b.date)).map(t => [t.date, t.type === 'income' ? 'Доход' : 'Расход', catOf(t.cat).name, t.amount, (t.note || '').replace(/[;\n]/g, ' ')])];
    download(`grosh-${TODAY}.csv`, '﻿' + rows.map(r => r.join(';')).join('\n'), 'text/csv');
    ui.toast('CSV сохранён');
  };
  const reset = () => ui.dialog({
    title: 'Стереть все данные?', msg: 'Записи, челленджи и награды удалятся с этого устройства. Отменить это нельзя.',
    actions: [{ label: 'Отмена', style: 'bold' }, { label: 'Стереть', style: 'destructive', run: () => { store.set(st => ({ tx: [], challenges: [], meta: { ...st.meta, backups: 0, lastBackupAt: null, calcUsed: false, recapSeen: null, ach: {}, demo: false }, profile: { ...st.profile, showcase: [], since: TODAY } })); ui.toast('Все данные стёрты'); } }],
  });
  const signOut = () => ui.dialog({
    title: 'Выйти из аккаунта?', msg: 'Данные останутся на этом устройстве, синхронизация остановится.',
    actions: [{ label: 'Отмена' }, { label: 'Выйти', style: 'destructive', run: async () => { if (supabase) await supabase.auth.signOut(); store.set(st => ({ profile: { ...st.profile, account: null } })); ui.toast('Вы вышли из аккаунта'); } }],
  });
  const acc = s.profile.account;
  const { sync } = useApp();
  const syncText = { idle: sync.lastAt ? 'Только что' : 'Готово', syncing: 'Синхронизация…', offline: 'Нет сети', error: 'Ошибка', off: 'Выключена' }[sync.status];
  const loadDemo = () => ui.dialog({
    title: 'Заполнить примером?', msg: 'Текущие записи на этом устройстве заменятся примером за три месяца. Данные в аккаунте не изменятся, пока пример не отправлен.',
    actions: [{ label: 'Отмена', style: 'bold' }, { label: 'Заполнить', run: () => { const d = makeDemo(); store.set({ ...d, profile: { ...d.profile, account: store.s.profile.account }, meta: { ...d.meta, onboarded: true } }); ui.toast('Загружен пример данных'); } }],
  });
  const last = s.meta.lastBackupAt ? dateLong(iso(new Date(s.meta.lastBackupAt))) : 'не было';
  const setMs = d => mutate(st => ({ settings: { ...st.settings, monthStart: Math.min(28, Math.max(1, st.settings.monthStart + d)) } }));
  return html`<${Page} title="Настройки" onClose=${onClose}>
    <div class="group"><button class="cell" onClick=${() => ui.page('profile')} style="min-height:76px">
      <span class="avatar avatar--lg" style=${`--c:var(--${s.profile.color})`}>${initials(s.profile.name) || html`<${Icon} n=\"person\" fill />`}</span>
      <span class="cell__main"><span class="t-title3">${s.profile.name}</span><span class="cell__sub">${acc ? (acc.email || 'Вход через ' + acc.provider) : 'Профиль и витрина наград'}</span></span><${Chevron} />
    </button></div>
    ${acc ? html`<div class="section"><div class="section__header">Аккаунт</div><div class="group">
        <button class="cell cell--icon" onClick=${() => syncNow()}><${Sq} icon="sync" color=${sync.status === 'error' ? 'red' : 'green'} /><span class="cell__main"><span>Синхронизация</span>${sync.error && html`<span class="cell__sub">${sync.error}</span>`}</span><span class="cell__value">${syncText}</span></button>
        <button class="cell cell--destructive" onClick=${signOut}>Выйти</button>
      </div><div class="section__footer">Записи синхронизируются между устройствами, где вы вошли. Нажмите, чтобы синхронизировать сейчас.</div></div>`
      : html`<div class="group"><button class="cell cell--icon" onClick=${() => ui.auth('welcome')}><${Sq} icon="cloud_sync" color="blue" /><span class="cell__main"><span>Войти в Грош</span><span class="cell__sub">Синхронизация между устройствами</span></span><${Chevron} /></button></div>`}
    <div class="section"><div class="section__header">Оформление</div><div class="group">
      <div class="cell cell--icon"><${Sq} icon="contrast" color="indigo" /><span class="cell__main">Тема</span><${Select} id="set-theme" label="Тема" value=${s.settings.theme} onChange=${v => set({ theme: v })} options=${[["system", "Как в системе"], ["light", "Светлая"], ["dark", "Тёмная"]]} /></div>
      <div class="cell cell--icon"><${Sq} icon="animation" color="teal" /><span class="cell__main">Анимации</span><${Select} id="set-motion" label="Анимации" value=${s.settings.motion} onChange=${v => set({ motion: v })} options=${[["full", "Все"], ["reduced", "Меньше"]]} /></div>
      <div class="cell cell--icon"><${Sq} icon="vibration" color="pink" /><span class="cell__main">Вибрация</span><${Switch} on=${s.settings.haptics} onChange=${v => set({ haptics: v })} label="Вибрация" /></div>
    </div></div>
    <div class="section"><div class="section__header">Учёт</div><div class="group">
      <div class="cell cell--icon"><${Sq} icon="calendar_month" color="red" /><span class="cell__main">Месяц начинается</span>
        <div class="stepper"><button aria-label="Раньше" onClick=${() => setMs(-1)}><${Icon} n="remove" /></button><b>${s.settings.monthStart}</b><button aria-label="Позже" onClick=${() => setMs(1)}><${Icon} n="add" /></button></div></div>
      <div class="cell cell--icon"><${Sq} icon="event" color="orange" /><span class="cell__main">Первый день недели</span><${Select} id="week-start" label="Первый день недели" value=${s.settings.weekStart} onChange=${v => set({ weekStart: +v })} options=${[[1, "Понедельник"], [0, "Воскресенье"], [6, "Суббота"]]} /></div>
      <button class="cell cell--icon" onClick=${() => ui.page('categories')}><${Sq} icon="category" color="green" /><span class="cell__main">Категории</span><span class="cell__value">${s.categories.filter(c => !c.archived && c.type !== 'transfer').length}</span><${Chevron} /></button>
      <button class="cell cell--icon" onClick=${() => ui.sheet({ kind: 'challenge' })}><${Sq} icon="flag" color="yellow" /><span class="cell__main">Новый челлендж</span><span class="cell__value">${s.challenges.length}</span><${Chevron} /></button>
    </div><div class="section__footer">Если зарплата приходит 10-го, поставьте 10 — статистика и итоги будут считаться с 10-го по 9-е.</div></div>
    <div class="section"><div class="section__header">Данные</div><div class="group">
      <button class="cell cell--icon" onClick=${() => ui.sheet({ kind: 'backup', auto: true })}><${Sq} icon="download" color="blue" /><span class="cell__main">Скачать бэкап</span><span class="cell__value">${last}</span><${Chevron} /></button>
      <button class="cell cell--icon" onClick=${() => fileRef.current.click()}><${Sq} icon="upload" color="blue" /><span class="cell__main">Загрузить бэкап</span><${Chevron} /></button>
      <button class="cell cell--icon" onClick=${csv}><${Sq} icon="table_view" color="green" /><span class="cell__main">Экспорт в CSV</span><${Chevron} /></button>
      <button class="cell cell--icon" onClick=${loadDemo}><${Sq} icon="auto_awesome" color="indigo" /><span class="cell__main">Заполнить примером</span><${Chevron} /></button>
    </div><div class="section__footer">Данные хранятся только на этом устройстве. Бэкап — это файл JSON, его можно загрузить обратно на любом устройстве.</div></div>
    <div class="section"><div class="group"><button class="cell cell--destructive" onClick=${reset}>Стереть все данные</button></div>
      <div class="section__footer">Грош 0.1 · прототип · схема данных v${s.v}${s.meta.demo ? ' · заполнено примерами' : ''}</div></div>
    <input type="file" id="import-file" accept="application/json,.json" ref=${fileRef} onChange=${onFile} hidden />
  <//>`;
}
