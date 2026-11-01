import { html } from 'htm/preact';
import { Sq, Chevron, Page } from '@grosh/ui-kit';
import { ui } from '../state/store.js';

export function Categories({ s, onClose }) {
  const list = type => s.categories.filter(c => c.type === type).sort((a, b) => a.order - b.order);
  return html`<${Page} title="Категории" onClose=${onClose}>
    ${[['expense', 'Расходы'], ['income', 'Доходы']].map(([t, title]) => html`<div class="section"><div class="section__header">${title}</div><div class="group">
      ${list(t).map(c => html`<button class="cell cell--icon" style=${c.archived ? 'opacity:.5' : ''} onClick=${() => ui.sheet({ kind: 'category', cat: c, auto: true })}><${Sq} c=${c} /><span class="cell__main">${c.name}</span>${c.archived ? html`<span class="cell__value">в архиве</span>` : ''}<${Chevron} /></button>`)}
      <button class="cell more" onClick=${() => ui.sheet({ kind: 'category', cat: { type: t }, auto: true })}>Новая категория</button>
    </div></div>`)}
  <//>`;
}
