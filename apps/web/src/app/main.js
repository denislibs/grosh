import { html } from 'htm/preact';
import { render } from 'preact';
import { ConfigProvider, ThemeProvider } from '@grosh/ui-kit';
import '@grosh/ui-kit/styles.css';
import './app.css';
import { makeEmpty } from './lib/seed.js';
import { SCHEMA, idb, store, ui, useStore } from './state/store.js';
import { initSync } from './state/sync.js';
import { lock } from './state/lock.js';
import { App } from './App.js';
import { Lock } from './screens/Lock.js';

// Провайдеры kit'а получают настройки из состояния приложения
function Root() {
  const s = useStore();
  // экран блокировки открывается до расшифровки данных — тему берём из копии в localStorage
  try { localStorage.setItem('grosh.theme', s.settings.theme); } catch (e) {}
  return html`<${ConfigProvider} haptics=${s.settings.haptics} motion=${s.settings.motion === 'reduced' ? 'reduced' : 'system'}>
    <${ThemeProvider} theme=${s.settings.theme} onChange=${theme => store.set(st => ({ settings: { ...st.settings, theme } }))}>
      <${App} />
    <//>
  <//>`;
}

const root = document.getElementById('root');

async function start() {
  let s = null;
  try { s = idb.db ? await idb.load('state') : null; } catch (e) { s = null; }
  if (!s || s.v !== SCHEMA) { s = makeEmpty(); idb.save('state', s).catch(() => {}); }
  store.s = s;
  await initSync();
  if (import.meta.env.DEV) window.__grosh = { store, ui, lock };
  render(html`<${Root} />`, root);
}

(async function boot() {
  try { await idb.open(); await lock.init(); } catch (e) { idb.db = null; }
  if (!lock.on) return start();
  let theme = 'system';
  try { theme = localStorage.getItem('grosh.theme') || 'system'; } catch (e) {}
  render(html`<${ThemeProvider} theme=${theme}><${Lock} onUnlock=${() => { render(null, root); start(); }} /><//>`, root);
})();
