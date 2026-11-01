import { html } from 'htm/preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { Icon, Sheet, Dialog, Island } from '@grosh/ui-kit';
import { evaluate } from './lib/achievements.js';
import { makeEmpty } from './lib/seed.js';
import { supabase } from './lib/supabase.js';
import { buzz, store, ui, useStore } from './state/store.js';
import { startSync, stopSync, syncState } from './state/sync.js';
import { AppContext } from './state/AppContext.js';
import { Auth } from './screens/Auth.js';
import { TxSheet } from './sheets/TxSheet.js';
import { Home } from './screens/Home.js';
import { CalendarScreen } from './screens/Calendar.js';
import { Stats } from './screens/Stats.js';
import { Awards } from './screens/Awards.js';
import { AchSheet } from './sheets/AchSheet.js';
import { Unlock } from './overlays/Unlock.js';
import { Recap } from './overlays/Recap.js';
import { Settings } from './screens/Settings.js';
import { Categories } from './screens/Categories.js';
import { Profile } from './screens/Profile.js';
import { InstSheet } from './sheets/InstSheet.js';
import { DepSheet } from './sheets/DepSheet.js';
import { ChallengeSheet } from './sheets/ChallengeSheet.js';
import { CategorySheet } from './sheets/CategorySheet.js';
import { BackupSheet, ImportSheet } from './sheets/BackupSheet.js';
import { AvatarSheet } from './sheets/AvatarSheet.js';
import { ShowcaseSheet } from './sheets/ShowcaseSheet.js';
import { PasskeySheet } from './sheets/PasskeySheet.js';

const TABS = ['home', 'calendar', 'stats', 'awards'];

function useSyncState() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); syncState.subs.add(f); return () => syncState.subs.delete(f); }, []);
  return syncState;
}

// Сессия Supabase → профиль и синхронизация
function useAuthSession(openAuth) {
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    const apply = (sess, event) => {
      setSession(sess);
      if (event === 'PASSWORD_RECOVERY') openAuth('newpass');
      if (!sess) { stopSync(); if (store.s.profile.account) store.set(st => ({ profile: { ...st.profile, account: null } })); return; }
      const u = sess.user;
      if (store.s.profile.account?.id !== u.id) {
        const name = u.user_metadata?.name || u.user_metadata?.full_name || '';
        store.set(st => ({ profile: { ...st.profile, name: st.profile.name || name, account: { id: u.id, email: u.email, provider: u.app_metadata?.provider || 'email' } }, meta: { ...st.meta, onboarded: true } }));
      }
      // '1' — перенести данные с устройства, '0' — взять из аккаунта; пример данных по умолчанию не переносим
      const pending = localStorage.getItem('grosh.migrate');
      localStorage.removeItem('grosh.migrate');
      const mode = pending === '0' || (pending !== '1' && store.s.meta.demo) ? 'replace' : 'merge';
      startSync(u.id, { mode, emptyState: makeEmpty });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, sess) => setTimeout(() => apply(sess, event), 0));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export function App() {
  const s = useStore();
  const sync = useSyncState();
  const [tab, setTab] = useState(() => { const h = location.hash.slice(1); return TABS.includes(h) ? h : 'home'; });
  const [sheet, setSheet] = useState(null);
  const [sheetOut, setSheetOut] = useState(false);
  const [pages, setPages] = useState([]);
  const [recap, setRecap] = useState(null);
  const [toast, setToast] = useState(null);
  const [unlocks, setUnlocks] = useState(null);
  const [auth, setAuth] = useState(() => (location.hash === '#auth' || (!s.meta.onboarded && !new URLSearchParams(location.search).has('embed')) ? 'welcome' : null));
  const [dialog, setDialog] = useState(null);
  const toastT = useRef();
  const { c, res } = useMemo(() => evaluate(s), [s]);
  const session = useAuthSession(step => setAuth(step));

  ui.sheet = v => { setSheetOut(false); setSheet(v); };
  ui.page = p => setPages(ps => [...ps.filter(x => x !== p), p]);
  ui.recap = setRecap;
  ui.auth = step => setAuth(step || 'welcome');
  ui.dialog = setDialog;
  ui.unlock = ids => setTimeout(() => setUnlocks(u => (u ? [...u, ...ids] : ids)), 450);
  ui.toast = (text, action, kind = 'ok') => {
    clearTimeout(toastT.current);
    setToast({ text, action, kind, id: Date.now(), closing: false });
    toastT.current = setTimeout(() => { setToast(t => t && { ...t, closing: true }); toastT.current = setTimeout(() => setToast(null), 330); }, action ? 4500 : 2400);
  };

  useEffect(() => {
    const h = () => { const v = location.hash.slice(1); if (TABS.includes(v)) setTab(v); };
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);
  useEffect(() => { try { history.replaceState(null, '', location.pathname + location.search + '#' + tab); } catch (e) {} }, [tab]);

  const tabs = [['home', 'home', 'Обзор'], ['calendar', 'calendar_month', 'Календарь'], ['stats', 'bar_chart', 'Статистика'], ['awards', 'emoji_events', 'Награды']];
  const tabBtn = ([id, icon, label]) => html`<button class="tab" aria-current=${tab === id ? 'page' : null} onClick=${() => { buzz(5); setTab(id); setPages([]); }}><${Icon} n=${icon} fill=${tab === id} /><span>${label}</span></button>`;
  const closePage = p => setPages(ps => ps.filter(x => x !== p));
  const sheetBody = close => {
    switch (sheet.kind) {
      case 'tx': return html`<${TxSheet} tx=${sheet.tx} preset=${sheet.preset} close=${close} />`;
      case 'ach': return html`<${AchSheet} id=${sheet.id} res=${res} close=${close} />`;
      case 'challenge': return html`<${ChallengeSheet} ch=${sheet.ch} close=${close} />`;
      case 'category': return html`<${CategorySheet} cat=${sheet.cat} close=${close} />`;
      case 'backup': return html`<${BackupSheet} close=${close} />`;
      case 'import': return html`<${ImportSheet} data=${sheet.data} close=${close} />`;
      case 'avatar': return html`<${AvatarSheet} close=${close} />`;
      case 'showcase': return html`<${ShowcaseSheet} slot=${sheet.slot} res=${res} close=${close} />`;
      case 'inst': return html`<${InstSheet} it=${sheet.it} close=${close} />`;
      case 'dep': return html`<${DepSheet} d=${sheet.d} close=${close} />`;
      case 'passkeys': return html`<${PasskeySheet} close=${close} />`;
    }
  };
  const ctx = { s, c, res, ui, session, sync };
  return html`<${AppContext.Provider} value=${ctx}>
    <div class=${'app' + (sheet && !sheetOut && !sheet.auto ? ' has-sheet' : '')}>
      <div class="stage">
        ${tab === 'home' && html`<${Home} key="home" s=${s} c=${c} />`}
        ${tab === 'calendar' && html`<${CalendarScreen} key="cal" s=${s} c=${c} />`}
        ${tab === 'stats' && html`<${Stats} key="stats" s=${s} c=${c} />`}
        ${tab === 'awards' && html`<${Awards} key="awards" s=${s} c=${c} res=${res} />`}
        <nav class="tabbar" aria-label="Разделы">
          ${tabBtn(tabs[0])}${tabBtn(tabs[1])}
          <button class="tab tab--add" aria-label="Новая запись" onClick=${() => { buzz(8); ui.sheet({ kind: 'tx' }); }}><${Icon} n="add_circle" fill /><span class="tab__label-wide">Новая запись</span><span class="tab__label-short">Добавить</span></button>
          ${tabBtn(tabs[2])}${tabBtn(tabs[3])}
        </nav>
        ${pages.map(p => html`<div key=${p}>${
          p === 'settings' ? html`<${Settings} s=${s} onClose=${() => closePage(p)} />`
          : p === 'profile' ? html`<${Profile} s=${s} c=${c} res=${res} onClose=${() => closePage(p)} />`
          : html`<${Categories} s=${s} onClose=${() => closePage(p)} />`}</div>`)}
      </div>
      ${sheet && html`<${Sheet} key=${sheet.kind + (sheet.tx?.id || sheet.id || sheet.it?.id || sheet.d?.id || '')} auto=${sheet.auto} onClosing=${() => setSheetOut(true)} onClose=${() => setSheet(null)}>${sheetBody}<//>`}
      ${recap != null && html`<${Recap} k=${recap} onClose=${() => { store.set(st => ({ meta: { ...st.meta, recapSeen: Math.max(st.meta.recapSeen ?? 0, recap) } })); setRecap(null); }} />`}
      ${unlocks && html`<${Unlock} ids=${unlocks} res=${res} onDone=${() => setUnlocks(null)} />`}
      ${auth && html`<${Auth} start=${auth} onClose=${() => setAuth(null)} />`}
      ${dialog && html`<${Dialog} d=${dialog} key=${dialog.title} onClose=${() => setDialog(null)} />`}
      ${toast && html`<${Island} key=${toast.id} toast=${toast} onAction=${() => setToast(null)} />`}
    </div>
  <//>`;
}
