import { html } from 'htm/preact';
import { SheetNav } from '@grosh/ui-kit';
import { ACH } from '../lib/achievements.js';
import { store } from '../state/store.js';
import { AchBadge } from '../components/AchBadge.js';

export function ShowcaseSheet({ slot, res, close }) {
  const got = ACH.filter(a => res[a.id].tier || res[a.id].count);
  const pick = id => { store.set(st => { const sc = [...st.profile.showcase].filter(x => x !== id); sc[slot] = id; return { profile: { ...st.profile, showcase: sc.filter(Boolean).slice(0, 3) } }; }); close(); };
  return html`<${SheetNav} title="Витрина" onCancel=${close} />
    <div class="sheet__body">
      ${got.length ? html`<div class="group badges">${got.map(a => html`<button class="badge-cell" onClick=${() => pick(a.id)}><${AchBadge} a=${a} r=${res[a.id]} size=${60} /><b>${a.n}</b></button>`)}</div>`
        : html`<div class="group"><div class="cell secondary">Пока нечего показать. Первая награда выдаётся за первую запись.</div></div>`}
    </div>`;
}
