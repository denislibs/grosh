import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon, Spinner } from '@grosh/ui-kit';
import { buzz } from '../state/store.js';
import { pwa, usePwa } from '../state/pwa.js';

/** Плашка «Доступна новая версия». */
export function UpdateBar({ page }) {
  const p = usePwa();
  const [busy, setBusy] = useState(false);
  if (!p.ready || p.dismissed) return null;
  const apply = () => { buzz(8); setBusy(true); pwa.apply(); };
  return html`<div class=${'update-bar' + (page ? ' update-bar--page' : '')} role="status">
    <span class="update-bar__text">Доступна новая версия</span>
    <button class="update-bar__btn" disabled=${busy} onClick=${apply}>${busy ? html`<${Spinner} />` : 'Обновить'}</button>
    <button class="update-bar__close" aria-label="Позже" onClick=${() => { pwa.dismissed = true; buzz(4); pwa.subs.forEach(f => f()); }}><${Icon} n="close" /></button>
  </div>`;
}
