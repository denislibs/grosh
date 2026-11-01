import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { useLabels } from '../config.js';
import { Icon } from './primitives.js';

const useScrolled = () => {
  const [sc, setSc] = useState(false);
  return [sc, e => { const v = e.currentTarget.scrollTop > 40; if (v !== sc) setSc(v); }];
};

/** Экран вкладки: большой заголовок, который при прокрутке уходит в компактный навбар. */
export function Screen({ title, left, right, accessory, children }) {
  const [sc, onScroll] = useScrolled();
  return html`<main class="screen" onScroll=${onScroll}>
    <div class=${'nav' + (sc ? ' is-scrolled' : '')}><div class="nav__l">${left}</div><div class="nav__title">${title}</div><div class="nav__r">${right}</div></div>
    <div class="inner">
      <h1 class="t-large large-title"><span>${title}</span>${accessory}</h1>
      ${children}
    </div>
  </main>`;
}

/** Экран, открытый «вглубь» (push): кнопка «Назад» и выезд справа. */
export function Page({ title, onClose, right, children }) {
  const t = useLabels();
  const [closing, setClosing] = useState(false);
  const [sc, onScroll] = useScrolled();
  const close = () => { setClosing(true); setTimeout(onClose, 300); };
  return html`<div class=${'page' + (closing ? ' is-closing' : '')} onScroll=${onScroll}>
    <div class=${'nav' + (sc ? ' is-scrolled' : '')}>
      <div class="nav__l"><button class="back" onClick=${close}><${Icon} n="chevron_left" />${t.back}</button></div>
      <div class="nav__title">${title}</div><div class="nav__r">${right}</div>
    </div>
    <div class="inner"><h1 class="t-large large-title"><span>${title}</span></h1>${children}</div>
  </div>`;
}

/** Секция списка: заголовок, группа ячеек, подпись. */
export const Section = ({ header, aside, footer, children, style }) => html`<div class="section" style=${style}>
  ${(header || aside) && html`<div class="section__header"><span>${header}</span>${aside != null && html`<span class="num">${aside}</span>`}</div>`}
  ${children}
  ${footer && html`<div class="section__footer">${footer}</div>`}
</div>`;
