import { html } from 'htm/preact';
import { useState, useRef, useMemo } from 'preact/hooks';
import { Icon, Sq } from '@grosh/ui-kit';
import { dayTitle, fmt } from '../lib/dates.js';
import { buzz, catOf, delTx, store, ui } from '../state/store.js';

export function TxRow({ t }) {
  const c = catOf(t.cat);
  const st = useRef(null), swiped = useRef(false);
  const [dx, setDx] = useState(0), [drag, setDrag] = useState(false), [gone, setGone] = useState(false);
  const down = e => { st.current = { x: e.clientX, y: e.clientY, dx: 0, lock: null }; swiped.current = false; };
  const move = e => {
    const o = st.current; if (!o) return;
    const ddx = e.clientX - o.x, ddy = e.clientY - o.y;
    if (o.lock === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) { o.lock = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y'; if (o.lock === 'x') { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); } }
    if (o.lock === 'x') { o.dx = Math.min(0, ddx); setDx(o.dx); if (o.dx < -110 && !o.armed) { o.armed = true; buzz(10); } }
  };
  const up = () => {
    const o = st.current; st.current = null; setDrag(false); if (!o) return;
    if (o.lock === 'x') { swiped.current = true; if (o.dx < -110) { setDx(-600); setGone(true); setTimeout(() => delTx(t), 300); } else setDx(0); }
  };
  return html`<div class=${'cell-wrap' + (gone ? ' is-gone' : '') + (dx < 0 ? ' is-drag' : '')}><div>
    <div class="swipe-del">Удалить</div>
    <button class="cell cell--tx" style=${`transform:translateX(${dx}px);transition:${drag ? 'none' : 'transform 420ms cubic-bezier(.32,.72,0,1), background 220ms'}`}
      onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}
      onClick=${() => { if (swiped.current) return; if (t.type === 'transfer') { const d = (store.s.deposits || []).find(x => x.id === t.dep); d && ui.sheet({ kind: 'dep', d }); } else ui.sheet({ kind: 'tx', tx: t }); }}>
      <${Sq} c=${c} size="md" />
      <span class="cell__main"><span class="cell__title">${c.name}</span><span class="cell__sub">${t.note || (t.type === 'income' ? 'Доход' : 'Без заметки')}</span></span>
      <span class=${'amt' + (t.type === 'income' ? ' amt--in' : '')} style=${t.type === 'transfer' ? 'color:var(--label-2)' : ''}>${t.type === 'income' ? '+' : t.type === 'transfer' ? (t.amount > 0 ? '→ ' : '← ') : '−'}${fmt(Math.abs(t.amount))} ₸</span>
    </button></div></div>`;
}
export function Ledger({ txs, limit }) {
  const groups = useMemo(() => {
    const m = new Map();
    [...txs].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).forEach(t => { if (!m.has(t.date)) m.set(t.date, []); m.get(t.date).push(t); });
    return [...m.entries()];
  }, [txs]);
  if (!groups.length) return html`<div class="card" style="text-align:center;justify-items:center"><${Icon} n="receipt_long" style="font-size:40px;color:var(--label-3)" /><b>Записей пока нет</b><span class="secondary t-subhead">Нажмите «+», чтобы добавить первую трату.</span></div>`;
  return html`<div class="col stagger" style="gap:24px">${groups.slice(0, limit).map(([d, list], gi) => {
    const exp = list.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    return html`<div class="section" style=${'--i:' + gi} key=${d}>
      <div class="section__header"><span>${dayTitle(d)}</span><span class="num">${exp ? '−' + fmt(exp) + ' ₸' : ''}</span></div>
      <div class="group">${list.map(t => html`<${TxRow} key=${t.id} t=${t} />`)}</div>
    </div>`;
  })}</div>`;
}
