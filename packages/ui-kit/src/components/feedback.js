import { html } from 'htm/preact';
import { useRef, useEffect } from 'preact/hooks';
import { useReducedMotion } from '../motion.js';
import { Icon } from './primitives.js';

/** Баннер. kind: 'info' | 'success' | 'warning' | 'error'. */
export const Banner = ({ kind = 'info', icon, title, children, action, onAction }) => {
  const ic = icon || { info: 'info', success: 'check_circle', warning: 'warning', error: 'error' }[kind];
  return html`<div class=${'banner' + (kind !== 'info' ? ' banner--' + kind : '')}>
    <${Icon} n=${ic} />
    <div class="banner__main">${title && html`<b>${title}</b>`}${children && html`<span>${children}</span>`}</div>
    ${action && html`<button onClick=${onAction}>${action}</button>`}
  </div>`;
};

/** Пустое состояние — приглашение к действию, а не извинение. */
export const Empty = ({ icon, title, children, action }) => html`<div class="empty">
  ${icon && html`<${Icon} n=${icon} />`}
  ${title && html`<b>${title}</b>`}
  ${children && html`<p>${children}</p>`}
  ${action}
</div>`;

/** Конфетти на canvas, цвета берутся из токенов темы. Растягивается на родителя. */
export function Confetti({ count = 120, colors = ['--orange', '--yellow', '--blue', '--green', '--pink', '--purple'] }) {
  const ref = useRef();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const cv = ref.current, ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
    const W = (cv.width = cv.offsetWidth * dpr), H = (cv.height = cv.offsetHeight * dpr);
    const st = getComputedStyle(document.documentElement);
    const cols = colors.map(v => st.getPropertyValue(v).trim() || v);
    const P = [...Array(count)].map(() => ({ x: W / 2, y: H * 0.3, vx: (Math.random() - 0.5) * 15 * dpr, vy: (-Math.random() * 13 - 4) * dpr, r: (Math.random() * 4 + 3) * dpr, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, sq: Math.random() < 0.5 }));
    let raf, t = 0;
    const step = () => {
      t++; ctx.clearRect(0, 0, W, H);
      for (const p of P) {
        p.vy += 0.34 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - t / 140);
        if (p.sq) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.4, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      if (t < 140) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return html`<canvas ref=${ref} aria-hidden="true"></canvas>`;
}
