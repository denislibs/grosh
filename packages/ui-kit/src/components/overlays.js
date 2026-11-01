import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { useLabels } from '../config.js';
import { Icon } from './primitives.js';

/**
 * Шторка: page sheet снизу на телефоне, окно по центру на десктопе, тянется вниз за ручку.
 * children может быть функцией (close) => …, чтобы контент закрывал шторку с анимацией.
 * onClosing вызывается в начале закрытия — чтобы экран позади успел вернуться в масштаб.
 */
export function Sheet({ onClose, onClosing, auto, float, children }) {
  const [closing, setClosing] = useState(false);
  const ref = useRef(), drag = useRef(null);
  const close = () => { if (closing) return; setClosing(true); onClosing && onClosing(); setTimeout(onClose, 330); };
  useEffect(() => { const k = e => e.key === 'Escape' && close(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const down = e => { drag.current = { y: e.clientY, dy: 0 }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => { const d = drag.current; if (!d) return; d.dy = Math.max(0, e.clientY - d.y); const el = ref.current; el.style.animation = 'none'; el.style.transition = 'none'; el.style.transform = `translateY(${d.dy}px)`; };
  const up = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    const el = ref.current; el.style.transition = 'transform 420ms cubic-bezier(.32,.72,0,1)';
    el.style.transform = d.dy > 120 ? 'translateY(100%)' : '';
    if (d.dy > 120) { onClosing && onClosing(); setTimeout(onClose, 380); }
  };
  const kids = typeof children === 'function' ? children(close) : Array.isArray(children) && typeof children[0] === 'function' ? children[0](close) : children;
  return html`<div class=${'scrim' + (closing ? ' is-closing' : '')} onClick=${close}></div>
    <div class=${'sheet' + (auto ? ' sheet--auto' : '') + (float ? ' sheet--float' : '') + (closing ? ' is-closing' : '')} ref=${ref} role="dialog" aria-modal="true">
      <div class="sheet__grab" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}></div>
      ${kids}
    </div>`;
}

/** Шапка шторки: «Отмена» — заголовок — действие. glass — круглые стеклянные кнопки ✕ и ✓, как в iOS 26–27. */
export function SheetNav({ title, onCancel, done, onDone, cancel, glass }) {
  const t = useLabels();
  if (glass) return html`<div class="sheet__nav sheet__nav--glass">
    <button class="glass-btn" aria-label=${cancel || t.cancel} onClick=${onCancel}><${Icon} n="close" /></button>
    <span class="sheet__title">${title}</span>
    ${done ? html`<button class="glass-btn glass-btn--tint" aria-label=${done} onClick=${onDone}><${Icon} n="check" /></button>` : html`<span></span>`}
  </div>`;
  return html`<div class="sheet__nav">
    <button class="btn btn--plain" onClick=${onCancel}>${cancel || t.cancel}</button>
    <span class="sheet__title">${title}</span>
    ${done ? html`<button class="btn btn--plain is-bold" onClick=${onDone}>${done}</button>` : html`<span></span>`}
  </div>`;
}

/**
 * Системный диалог.
 * d = { type: 'alert' | 'actions', title, msg, actions: [{ label, style: 'bold' | 'destructive', run }], cancel }
 */
export function Dialog({ d, onClose }) {
  const t = useLabels();
  const [closing, setClosing] = useState(false);
  const done = fn => { if (closing) return; setClosing(true); setTimeout(() => { onClose(); fn && fn(); }, 230); };
  if (d.type === 'actions') return html`<div class=${'dialog dialog--sheet' + (closing ? ' is-closing' : '')} onClick=${e => e.target === e.currentTarget && done()}>
    <div class="action-sheet">
      <div class="action-sheet__group">
        ${d.title && html`<div class="action-sheet__title"><b>${d.title}</b>${d.msg}</div>`}
        ${d.actions.map(a => html`<button class=${'action-sheet__btn' + (a.style === 'destructive' ? ' action-sheet__btn--destructive' : '')} onClick=${() => done(a.run)}>${a.label}</button>`)}
      </div>
      <button class="action-sheet__cancel" onClick=${() => done()}>${d.cancel || t.cancel}</button>
    </div>
  </div>`;
  return html`<div class=${'dialog' + (closing ? ' is-closing' : '')}>
    <div class="alert" role="alertdialog" aria-label=${d.title}>
      <div class="alert__body"><div class="alert__title">${d.title}</div>${d.msg && html`<div class="alert__msg">${d.msg}</div>`}</div>
      <div class=${'alert__actions' + (d.actions.length > 2 ? ' alert__actions--stack' : '')}>
        ${d.actions.map(a => html`<button class=${'alert__btn' + (a.style ? ' alert__btn--' + a.style : '')} onClick=${() => done(a.run)}>${a.label}</button>`)}
      </div>
    </div>
  </div>`;
}

/**
 * Уведомление-«остров» сверху.
 * toast = { text, kind: 'ok' | 'error' | 'delete', action: { label, run }, closing }
 */
export function Island({ toast, onAction }) {
  const icon = toast.kind === 'error' ? 'error' : toast.kind === 'delete' ? 'delete' : 'check_circle';
  return html`<div class=${'island' + (toast.closing ? ' is-closing' : '')} role="status">
    <${Icon} n=${icon} style=${toast.kind === 'ok' || !toast.kind ? '' : 'color:var(--red)'} />
    <span>${toast.text}</span>
    ${toast.action && html`<button onClick=${() => { toast.action.run(); onAction && onAction(); }}>${toast.action.label}</button>`}
  </div>`;
}
