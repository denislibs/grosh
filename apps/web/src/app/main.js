import { html } from 'htm/preact';
import { render } from 'preact';
import { ConfigProvider, ThemeProvider } from '@grosh/ui-kit';
import '@grosh/ui-kit/styles.css';
import './app.css';
import { makeEmpty } from './lib/seed.js';
import { SCHEMA, idb, store, ui, useStore } from './state/store.js';
import { initSync } from './state/sync.js';
import { App } from './App.js';

// Провайдеры kit'а получают настройки из состояния приложения
function Root() {
  const s = useStore();
  return html`<${ConfigProvider} haptics=${s.settings.haptics} motion=${s.settings.motion === 'reduced' ? 'reduced' : 'system'}>
    <${ThemeProvider} theme=${s.settings.theme} onChange=${theme => store.set(st => ({ settings: { ...st.settings, theme } }))}>
      <${App} />
    <//>
  <//>`;
}

(async function boot() {
  let s = null;
  try { await idb.open(); s = await idb.get('state'); } catch (e) { idb.db = null; }
  if (!s || s.v !== SCHEMA) { s = makeEmpty(); if (idb.db) idb.put('state', s).catch(() => {}); }
  store.s = s;
  await initSync();
  if (import.meta.env.DEV) window.__grosh = { store, ui };
  render(html`<${Root} />`, document.getElementById('root'));
})();
