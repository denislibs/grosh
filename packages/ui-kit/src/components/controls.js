import { html } from 'htm/preact';
import { haptic } from '../haptics.js';
import { useLabels } from '../config.js';
import { Icon } from './primitives.js';

/** Сегментный переключатель. items: [[value, label], …] */
export function Seg({ items, value, onChange, style }) {
  const i = Math.max(0, items.findIndex(x => x[0] === value));
  return html`<div class="seg" role="radiogroup" style=${`--n:${items.length};--i:${i};${style || ''}`}>
    <span class="seg__thumb"></span>
    ${items.map(([v, label]) => html`<button role="radio" aria-checked=${String(v === value)} aria-pressed=${String(v === value)} onClick=${() => { haptic(5); onChange(v); }}>${label}</button>`)}
  </div>`;
}

export const Switch = ({ on, onChange, label }) =>
  html`<button class="switch" role="switch" aria-checked=${String(!!on)} aria-label=${label} onClick=${() => { haptic(5); onChange(!on); }}></button>`;

/** Кружок-чекбокс как в «Напоминаниях». square — квадратный вариант, color — цвет заливки. */
export const Check = ({ checked, onChange, label, square, color }) =>
  html`<button class=${'check' + (square ? ' check--square' : '')} role="checkbox" aria-checked=${String(!!checked)} aria-label=${label} style=${color ? `--c:var(--${color})` : ''} onClick=${e => { e.stopPropagation(); haptic(5); onChange(!checked); }}><${Icon} n="check" /></button>`;

export function Stepper({ value, min = -Infinity, max = Infinity, step = 1, onChange }) {
  const t = useLabels();
  const set = v => { haptic(4); onChange(Math.min(max, Math.max(min, v))); };
  return html`<div class="stepper">
    <button aria-label=${t.decrease} disabled=${value <= min} onClick=${() => set(value - step)}><${Icon} n="remove" /></button>
    <b>${value}</b>
    <button aria-label=${t.increase} disabled=${value >= max} onClick=${() => set(value + step)}><${Icon} n="add" /></button>
  </div>`;
}

/** Капсула-фильтр. */
export const Capsule = ({ pressed, onClick, icon, children }) =>
  html`<button class="capsule" aria-pressed=${String(!!pressed)} onClick=${onClick}>${icon && html`<${Icon} n=${icon} fill />`}${children}</button>`;

/** Слайдер; value в единицах min..max. */
export const Slider = ({ id, value, min = 0, max = 100, step = 1, color, onInput, label }) =>
  html`<input type="range" class="slider" id=${id} aria-label=${label} min=${min} max=${max} step=${step} value=${value}
    style=${`--p:${((value - min) / (max - min)) * 100}%;${color ? '--c:' + color : ''}`}
    onInput=${e => { haptic(2); onInput(+e.target.value); }} />`;
