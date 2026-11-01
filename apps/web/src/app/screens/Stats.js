import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon, Sq, Seg, Screen, useCountUp } from '@grosh/ui-kit';
import { M_NOM, NOW, TODAY, WD, addDays, cap, dateLong, dayTitle, diffDays, fmt, iso, kfmt, money, pKey, pRange, pad2, parse } from '../lib/dates.js';
import { buzz, catOf, ui } from '../state/store.js';

export function rangeFor(mode, off, s) {
  if (mode === 'week') {
    const d = addDays(NOW, -((NOW.getDay() - s.settings.weekStart + 7) % 7) + off * 7);
    const a = iso(d), b = iso(addDays(d, 6));
    return { a, b, label: `${dateLong(a)} — ${dateLong(b)}` };
  }
  if (mode === 'month') {
    const k = pKey(TODAY, s.settings.monthStart) + off;
    const [a, b] = pRange(k, s.settings.monthStart);
    return { a, b, k, label: cap(M_NOM[k % 12]) + ' ' + Math.floor(k / 12) };
  }
  const yy = NOW.getFullYear() + off;
  return { a: `${yy}-01-01`, b: `${yy}-12-31`, label: String(yy) };
}
export const CountUp = ({ v, dur = 900 }) => { const x = useCountUp(v, { duration: dur, fromZero: true }); return fmt(x); };
export function Stats({ s, c }) {
  const [mode, setMode] = useState('month');
  const [off, setOff] = useState(0);
  const [kind, setKind] = useState('expense');
  const [selCat, setSelCat] = useState(null);
  const [selBar, setSelBar] = useState(null);
  const r = rangeFor(mode, off, s), pr = rangeFor(mode, off - 1, s);
  const inR = (t, x) => t.date >= x.a && t.date <= x.b;
  const cur = c.txs.filter(t => inR(t, r)), prev = c.txs.filter(t => inR(t, pr));
  const sum = (arr, ty) => arr.filter(t => t.type === ty).reduce((a, t) => a + t.amount, 0);
  const total = sum(cur, kind), prevTotal = sum(prev, kind);
  const exp = sum(cur, 'expense'), inc = sum(cur, 'income');
  const span = Math.max(1, diffDays(r.a, r.b < TODAY ? r.b : TODAY) + 1);
  const delta = prevTotal ? Math.round((total - prevTotal) / prevTotal * 100) : null;
  const good = kind === 'expense' ? delta < 0 : delta > 0;
  const accent = kind === 'expense' ? 'var(--red)' : 'var(--green)';

  const byCat = {};
  cur.filter(t => t.type === kind).forEach(t => (byCat[t.cat] = (byCat[t.cat] || 0) + t.amount));
  const segs = Object.entries(byCat).sort((x, y) => y[1] - x[1]).map(([id, v]) => ({ id, v, cat: catOf(id) }));

  let bars = [];
  if (mode === 'year') bars = M_NOM.map((n, i) => { const pre = `${r.a.slice(0, 4)}-${pad2(i + 1)}`; return { label: n[0].toUpperCase(), full: cap(n), v: cur.filter(t => t.type === kind && t.date.startsWith(pre)).reduce((a, t) => a + t.amount, 0), future: `${pre}-01` > TODAY }; });
  else { for (let d = parse(r.a); iso(d) <= r.b; d = addDays(d, 1)) { const ds = iso(d); bars.push({ label: mode === 'week' ? WD[d.getDay()] : (d.getDate() === 1 || d.getDate() % 7 === 0 ? d.getDate() : ''), full: dayTitle(ds), v: cur.filter(t => t.type === kind && t.date === ds).reduce((a, t) => a + t.amount, 0), future: ds > TODAY }); } }
  const past = bars.filter(x => !x.future);
  const maxRaw = Math.max(1, ...bars.map(x => x.v));
  const step = Math.pow(10, Math.floor(Math.log10(maxRaw)));
  const maxB = Math.ceil(maxRaw / step) * step;
  const avg = past.length ? past.reduce((a, x) => a + x.v, 0) / past.length : 0;
  const keyR = mode + off + kind;
  const canRecap = mode === 'month' && r.k < c.cur && c.per.has(r.k);

  return html`<${Screen} title="Статистика" right=${canRecap && html`<button class="btn btn--plain is-bold" onClick=${() => ui.recap(r.k)}>Итоги</button>`}>
    <div class="col" style="gap:14px">
      <${Seg} items=${[['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']]} value=${mode} onChange=${v => { setMode(v); setOff(0); setSelBar(null); }} />
      <div class="period">
        <button class="circle-btn circle-btn--tint" aria-label="Раньше" onClick=${() => { setOff(o => o - 1); setSelBar(null); }}><${Icon} n="chevron_left" /></button>
        <b>${r.label}</b>
        <button class="circle-btn circle-btn--tint" aria-label="Позже" style=${off >= 0 ? 'opacity:.3' : ''} onClick=${() => { if (off < 0) { setOff(o => o + 1); setSelBar(null); } }}><${Icon} n="chevron_right" /></button>
      </div>
    </div>
    <div class="split">
      <div class="col">
        <div class="card">
          <${Seg} items=${[['expense', 'Расходы'], ['income', 'Доходы']]} value=${kind} onChange=${v => { setKind(v); setSelCat(null); setSelBar(null); }} />
          <div key=${'m' + keyR + selBar}>
            <div class="metric__label">${selBar != null ? bars[selBar].full : kind === 'expense' ? 'Потрачено' : 'Получено'}</div>
            <div class="metric__v">${selBar != null ? fmt(bars[selBar].v) : html`<${CountUp} v=${total} />`}<small>₸</small></div>
            <div class="metric__sub">${selBar != null ? 'Нажмите ещё раз, чтобы сбросить' : `Среднее: ${money(avg)} в ${mode === 'year' ? 'месяц' : 'день'}`}</div>
          </div>
          <div class=${'chart' + (selBar != null ? ' has-sel' : '')} key=${'b' + keyR}>
            ${[1, .5, 0].map(f => html`<div class="chart__grid" style=${`bottom:${f * 100}%`}><span>${f ? kfmt(maxB * f) : '0'}</span></div>`)}
            ${avg > 0 && html`<div class="chart__avg" style=${`bottom:${avg / maxB * 100}%;--c:${accent}`}></div>`}
            ${bars.map((x, i) => html`<button class=${'bar' + (selBar === i ? ' is-sel' : '') + (x.future ? ' is-future' : '')} style=${`--i:${i};--h:${x.v / maxB};--c:${accent}`} onClick=${() => { buzz(4); setSelBar(selBar === i ? null : i); }} aria-label=${x.full + ': ' + money(x.v)}><i></i></button>`)}
          </div>
          <div class="chart__labels">${bars.map(x => html`<span>${x.label}</span>`)}</div>
        </div>
        <div class="group">
          <div class="cell"><span class="cell__main">Расход</span><span class="cell__value">${money(exp)}</span></div>
          <div class="cell"><span class="cell__main">Доход</span><span class="cell__value">${money(inc)}</span></div>
          <div class="cell"><span class="cell__main">${kind === 'expense' ? 'В среднем за день' : 'Отложено'}</span><span class="cell__value">${kind === 'expense' ? money(exp / span) : money(Math.max(0, inc - exp)) + (inc ? ` · ${Math.round(Math.max(0, inc - exp) / inc * 100)}%` : '')}</span></div>
          <div class="cell"><span class="cell__main">Против прошлого периода</span><span class=${'cell__value ' + (delta == null ? '' : good ? 'delta-good' : 'delta-bad')}>${delta == null ? 'нет данных' : `${delta > 0 ? '+' : ''}${delta}%`}</span></div>
        </div>
      </div>
      <div class="section">
        <div class="section__header"><span>По категориям</span></div>
        ${segs.length ? html`<div class="group legend" key=${'l' + keyR}>
          <div class="cell" style="display:block"><div class=${'stackbar' + (selCat ? ' has-sel' : '')}>${segs.map((g, i) => html`<i class=${selCat === g.id ? 'is-sel' : ''} style=${`--p:${g.v / total};--c:var(--${g.cat.color});--i:${i}`}></i>`)}</div></div>
          ${segs.map(g => html`<button class=${'cell cell--icon' + (selCat && selCat !== g.id ? ' is-dim' : '')} onClick=${() => { buzz(4); setSelCat(selCat === g.id ? null : g.id); }}>
            <${Sq} c=${g.cat} />
            <span class="cell__main"><span class="cell__title">${g.cat.name}</span></span>
            <span class="cell__value">${Math.round(g.v / total * 100)}%</span>
            <span class="amt" style="min-width:92px;text-align:right">${fmt(g.v)} ₸</span>
          </button>`)}
        </div>` : html`<div class="group"><div class="cell"><span class="secondary">За этот период записей нет</span></div></div>`}
      </div>
    </div>
  <//>`;
}
