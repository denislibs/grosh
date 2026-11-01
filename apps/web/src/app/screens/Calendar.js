import { html } from 'htm/preact';
import { useState, useRef } from 'preact/hooks';
import { Icon, Screen } from '@grosh/ui-kit';
import { M_NOM, NOW, TODAY, WD, dateLong, dayTitle, fmt, iso, kfmt, money } from '../lib/dates.js';
import { buzz, ui } from '../state/store.js';
import { TxRow } from '../components/Ledger.js';

export function CalendarScreen({ s, c }) {
  const [ym, setYm] = useState(NOW.getFullYear() * 12 + NOW.getMonth());
  const [sel, setSel] = useState(TODAY);
  const [dir, setDir] = useState(0);
  const y = Math.floor(ym / 12), m = ym % 12;
  const dim = new Date(y, m + 1, 0).getDate();
  const ws = s.settings.weekStart;
  const lead = (new Date(y, m, 1).getDay() - ws + 7) % 7;
  const wds = [...Array(7)].map((_, i) => WD[(i + ws) % 7]);
  const dates = [...Array(dim)].map((_, i) => iso(new Date(y, m, i + 1)));
  const vals = dates.map(d => c.days.get(d)?.exp || 0);
  const nz = vals.filter(Boolean).sort((a, b) => a - b);
  const capV = nz.length ? nz[Math.floor(nz.length * .85)] : 1;
  const mExp = vals.reduce((a, b) => a + b, 0), mInc = dates.reduce((a, d) => a + (c.days.get(d)?.inc || 0), 0);
  const zero = dates.filter(d => d < TODAY && d >= c.first && !(c.days.get(d)?.exp)).length;
  const go = d => { buzz(5); setDir(d); setYm(v => v + d); };
  const sw = useRef(null);
  const selTx = c.txs.filter(t => t.date === sel).sort((a, b) => b.createdAt - a.createdAt);
  const selExp = selTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  return html`<${Screen} title="Календарь">
    <div class="split split--wide">
      <div class="group cal-card cal-wrap"
        onPointerDown=${e => (sw.current = { x: e.clientX, y: e.clientY })}
        onPointerUp=${e => { const o = sw.current; sw.current = null; if (!o) return; const dx = e.clientX - o.x; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - o.y)) go(dx < 0 ? 1 : -1); }}>
        <div class="cal-head">
          <b><span>${M_NOM[m]}</span> ${y}</b>
          <button class="btn btn--plain" aria-label="Предыдущий месяц" onClick=${() => go(-1)}><${Icon} n="chevron_left" /></button>
          <button class="btn btn--plain" aria-label="Следующий месяц" onClick=${() => go(1)}><${Icon} n="chevron_right" /></button>
        </div>
        <div class=${'cal ' + (dir > 0 ? 'cal-anim-l' : dir < 0 ? 'cal-anim-r' : '')} key=${ym}>
          ${wds.map(w => html`<div class="cal__wd">${w}</div>`)}
          ${[...Array(lead)].map(() => html`<div class="day day--out"></div>`)}
          ${dates.map((d, i) => {
            const v = vals[i], h = Math.min(1, v / capV), fut = d > TODAY;
            const cls = ['day', d === TODAY && 'day--today', d === sel && 'day--sel', fut && 'day--future'].filter(Boolean).join(' ');
            return html`<button class=${cls} style=${`--h:${Math.round(25 + h * 75)}%`} onClick=${() => { buzz(4); setSel(d); }} aria-label=${dateLong(d)}>
              <span class="day__n">${i + 1}</span>
              <span class="day__v">${v ? kfmt(v) : c.days.get(d)?.inc ? html`<span class="day__inc" style="display:inline-block"></span>` : ''}</span>
            </button>`;
          })}
        </div>
        <div class="cal-sum"><span>Расход <b>${fmt(mExp)} ₸</b></span><span>Доход <b>${fmt(mInc)} ₸</b></span>${zero ? html`<span>Без трат <b>${zero}</b></span>` : ''}</div>
      </div>
      <div class="section" key=${sel}>
        <div class="section__header"><span>${dayTitle(sel)}</span><span class="num">${selExp ? '−' + money(selExp) : ''}</span></div>
        <div class="group">
          ${selTx.map(t => html`<${TxRow} key=${t.id} t=${t} />`)}
          ${!selTx.length && html`<div class="cell"><span class="secondary">${sel > TODAY ? 'Этот день ещё впереди' : 'В этот день трат не было'}</span></div>`}
          ${sel <= TODAY && html`<button class="cell more" onClick=${() => ui.sheet({ kind: 'tx', preset: { date: sel } })}>Добавить на ${sel === TODAY ? 'сегодня' : dateLong(sel)}</button>`}
        </div>
        ${!selTx.length && sel < TODAY && html`<div class="section__footer">Дни без трат приближают награду «Монах».</div>`}
      </div>
    </div>
  <//>`;
}
