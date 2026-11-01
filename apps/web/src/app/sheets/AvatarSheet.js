import { html } from 'htm/preact';
import { Icon, SheetNav } from '@grosh/ui-kit';
import { initials } from '../lib/dates.js';
import { COLORS } from '../lib/categories.js';
import { buzz, store } from '../state/store.js';

export function AvatarSheet({ close }) {
  const p = store.s.profile;
  return html`<${SheetNav} title="Цвет профиля" onCancel=${close} cancel="Закрыть" />
    <div class="sheet__body">
      <div style="display:grid;justify-items:center"><span class="avatar avatar--xl" style=${`--c:var(--${p.color})`}>${initials(p.name) || html`<${Icon} n=\"person\" fill />`}</span></div>
      <div class="group colors">${COLORS.map(c => html`<button class="color" style=${`--c:var(--${c})`} aria-pressed=${String(c === p.color)} aria-label=${'Цвет ' + c} onClick=${() => { buzz(5); store.set(st => ({ profile: { ...st.profile, color: c } })); }}></button>`)}</div>
    </div>`;
}
