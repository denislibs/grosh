import { html } from 'htm/preact';
import { useLabels } from '../config.js';

/** Иконка Material Symbols Rounded. fill — залитый вариант. */
export const Icon = ({ n, fill, style, cls = '' }) =>
  html`<span class=${'ms ' + cls + (fill ? ' fill' : '')} style=${style} aria-hidden="true">${n}</span>`;

/** Белый глиф на цветном квадрате, как в Настройках iOS. color — имя системного цвета (orange, green…). */
export const Sq = ({ icon, color = 'gray', size = '', c }) => {
  const i = c ? c.icon : icon, col = c ? c.color : color;
  return html`<span class=${'sq ' + (size ? 'sq--' + size : '')} style=${`--c:var(--${col})`}><${Icon} n=${i} /></span>`;
};

export const Chevron = () => html`<${Icon} n="chevron_right" cls="cell__chev" />`;

export const Tag = ({ color = 'gray', solid, icon, children }) =>
  html`<span class=${'tag' + (solid ? ' tag--solid' : '')} style=${`--c:var(--${color})`}>${icon && html`<${Icon} n=${icon} />`}${children}</span>`;

export const Count = ({ children }) => html`<span class="count">${children}</span>`;

export function Spinner({ size = 20 }) {
  const t = useLabels();
  return html`<span class="spinner" style=${'--s:' + size + 'px'} role="status" aria-label=${t.loading}>${[0, 1, 2, 3, 4, 5, 6, 7].map(k => html`<i style=${'--k:' + k}></i>`)}</span>`;
}

/** Линейный прогресс. value 0..1. */
export const Progress = ({ value, color = 'var(--tint)', delay = 0, style = '' }) =>
  html`<div class="progress" style=${`--p:${Math.max(0, Math.min(1, value))};--c:${color};--delay:${delay}ms;${style}`}><i></i></div>`;

/** Кольцо прогресса. value 0..1, label — подпись в центре. */
export function Ring({ value, color = 'var(--tint)', size = 56, width = 10, label }) {
  const C = +(2 * Math.PI * 42).toFixed(1);
  return html`<div class="ring" style=${`--size:${size}px;--c:${color}`}>
    <svg viewBox="0 0 96 96" aria-hidden="true"><circle class="ring__track" cx="48" cy="48" r="42" style=${'stroke-width:' + width} /><circle class="ring__val" cx="48" cy="48" r="42" stroke-dasharray=${C} style=${`stroke-width:${width};stroke-dashoffset:${C * (1 - Math.max(0, Math.min(1, value)))};--len:${C}`} /></svg>
    ${label != null && html`<b>${label}</b>`}
  </div>`;
}

/**
 * Бейдж-награда с кольцом прогресса, как в «Активности».
 * tier: 'bronze' | 'silver' | 'gold' | 'locked'; progress 0..1; count — «×N».
 */
export function Badge({ icon, tier = 'gold', progress = 1, count = 0, size = 72, style = '' }) {
  const R = 46, C = +(2 * Math.PI * R).toFixed(1);
  return html`<div class=${'badge badge--' + tier} style=${`--size:${size}px;${style}`}>
    <svg class="badge__ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="badge__track" cx="50" cy="50" r=${R} />${progress > 0 && html`<circle class="badge__val" cx="50" cy="50" r=${R} stroke-dasharray=${C} style=${`stroke-dashoffset:${C * (1 - Math.min(1, progress))};--len:${C}`} />`}</svg>
    <div class="badge__core"><span class="ms">${icon}</span></div>
    ${count > 1 && html`<span class="badge__count">×${count}</span>`}
  </div>`;
}

export const Avatar = ({ color = 'blue', size = '', children, onClick, label }) =>
  html`<${onClick ? 'button' : 'span'} class=${'avatar' + (size ? ' avatar--' + size : '')} style=${`--c:var(--${color})`} onClick=${onClick} aria-label=${label}>${children}<//>`;
