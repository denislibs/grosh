import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Icon } from './primitives.js';
import { haptic } from '../haptics.js';

/**
 * Ввод код-пароля как в iOS: точки и цифровая клавиатура (работает и с клавиатуры компьютера).
 * onComplete(code) → false: код не подошёл — точки дрогнут и очистятся.
 * left — что поставить слева от нуля (например, кнопку Face ID).
 */
export function Passcode({ length = 6, title, sub, error, disabled, onComplete, left }) {
  const [code, setCode] = useState(''), [shake, setShake] = useState(0);
  const press = d => { if (disabled) return; haptic(4); setCode(c => (c.length < length ? c + d : c)); };
  const erase = () => { if (disabled) return; setCode(c => c.slice(0, -1)); };

  useEffect(() => {
    if (code.length !== length) return;
    Promise.resolve(onComplete(code)).then(ok => {
      if (ok === false) { setShake(x => x + 1); haptic([10, 30, 10]); setTimeout(() => setCode(''), 380); }
      else setCode('');
    });
  }, [code]);

  useEffect(() => {
    const k = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); erase(); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [disabled]);

  const key = d => html`<button class="passcode__key" disabled=${disabled} onClick=${() => press(String(d))}>${d}</button>`;
  return html`<div class=${'passcode' + (disabled ? ' is-disabled' : '')}>
    ${title && html`<div class="passcode__title">${title}</div>`}
    <div class=${'passcode__dots' + (shake ? ' is-shake' : '')} key=${shake} role="img" aria-label=${`Введено ${code.length} из ${length}`}>
      ${Array.from({ length }, (_, i) => html`<i class=${i < code.length ? 'is-on' : ''}></i>`)}
    </div>
    <div class=${'passcode__sub' + (error ? ' is-error' : '')} aria-live="polite">${error || sub || ' '}</div>
    <div class="passcode__pad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(key)}
      <span class="passcode__slot">${left}</span>
      ${key(0)}
      <span class="passcode__slot">${code.length > 0 && html`<button class="passcode__key passcode__key--plain" aria-label="Стереть" disabled=${disabled} onClick=${erase}><${Icon} n="backspace" /></button>`}</span>
    </div>
  </div>`;
}
