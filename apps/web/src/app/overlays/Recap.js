import { html } from 'htm/preact';
import { useState, useRef, useMemo } from 'preact/hooks';
import { Icon, useCountUp } from '@grosh/ui-kit';
import { M_INS, M_NOM, M_PREP, WD_LONG, addDays, cap, dateLong, diffDays, fmt, iso, kfmt, money, pRange, parse, plural } from '../lib/dates.js';
import { depState } from '../lib/finance.js';
import { ACH, buildCtx, evaluate } from '../lib/achievements.js';
import { buzz, catOf, store } from '../state/store.js';
import { AchBadge } from '../components/AchBadge.js';

export function recapData(s, c, k) {
  const p = c.per.get(k), prev = c.per.get(k - 1);
  const [a, b] = pRange(k, c.ms);
  const txs = c.txs.filter(t => t.date >= a && t.date <= b);
  const cats = Object.entries(p.byCat).sort((x, y) => y[1] - x[1]).map(([id, v]) => ({ cat: catOf(id), v }));
  const dayTot = {};
  txs.filter(t => t.type === 'expense' && t.cat !== 'home').forEach(t => (dayTot[t.date] = (dayTot[t.date] || 0) + t.amount));
  const topDay = Object.entries(dayTot).sort((x, y) => y[1] - x[1])[0];
  const topDayItems = topDay ? txs.filter(t => t.date === topDay[0] && t.type === 'expense').sort((x, y) => y.amount - x.amount).slice(0, 3) : [];
  const { res } = evaluate(s);
  const badges = ACH.filter(x => x.monthly && res[x.id].periods.includes(k)).map(x => [x, res[x.id]]);
  const taxi = p.byCat.taxi || 0, taxiPrev = prev?.byCat.taxi || 0;
  const ch = s.challenges.find(x => x.cat === 'taxi');
  const instPaid = txs.filter(t => t.inst).reduce((x, t) => x + t.amount, 0);
  const deps = (s.deposits || []).filter(d => d.start <= b);
  const depGrow = deps.reduce((x, d) => x + depState(d, c.txs, b).bal - depState(d, c.txs, iso(addDays(parse(a), -1))).bal, 0);
  const depInt = deps.reduce((x, d) => x + depState(d, c.txs, b).interest - depState(d, c.txs, iso(addDays(parse(a), -1))).interest, 0);
  return { k, p, prev, cats, topDay, topDayItems, badges, taxi, taxiPrev, ch, instPaid, depGrow, depInt, n: txs.length, days: diffDays(a, b) + 1 };
}
export const Big = ({ v }) => { const x = useCountUp(v, { duration: 1400, fromZero: true }); return html`${fmt(x)} ₸`; };
export function Recap({ k, onClose }) {
  const d = useMemo(() => recapData(store.s, buildCtx(store.s), k), [k]);
  const [i, setI] = useState(0), [paused, setPaused] = useState(false);
  const m = k % 12, saved = d.p.inc - d.p.exp, rate = d.p.inc ? Math.round(saved / d.p.inc * 100) : 0;
  const slides = [
    { tone: 'indigo', body: html`<span class="story__eyebrow" style="--i:0">Итоги месяца</span>
        <div class="story__title" style="--i:1">${M_NOM[m].split('').map((ch, l) => html`<span style=${'--l:' + l}>${ch}</span>`)}</div>
        <p class="story__txt" style="--i:2"><b>${d.days} ${plural(d.days, 'день', 'дня', 'дней')}</b> и <b>${d.n} ${plural(d.n, 'запись', 'записи', 'записей')}</b>. Смотрим, куда ушли деньги.</p>` },
    { tone: 'pink', body: html`<span class="story__eyebrow" style="--i:0">Потрачено в ${M_PREP[m]}</span>
        <div class="story__big" style="--i:1"><${Big} v=${d.p.exp} /></div>
        <p class="story__txt" style="--i:2">Заработано <b>${money(d.p.inc)}</b>.</p>
        <div class="story__rows" style="--i:3"><div class="story__row"><div><span>Расход от дохода</span><b>${d.p.inc ? Math.round(d.p.exp / d.p.inc * 100) : 100}%</b></div><div class="progress"><i style=${`--p:${d.p.inc ? Math.min(1, d.p.exp / d.p.inc) : 1};--delay:500ms`}></i></div></div></div>` },
    d.cats[0] && { tone: 'orange', body: html`<span class="story__eyebrow" style="--i:0">Больше всего ушло на</span>
        <div class="story__icon" style="--i:1"><span class="ms">${d.cats[0].cat.icon}</span></div>
        <div class="story__big" style="--i:2;font-size:clamp(34px,10vw,48px)">${d.cats[0].cat.name}</div>
        <p class="story__txt" style="--i:3"><b>${money(d.cats[0].v)}</b>, это ${Math.round(d.cats[0].v / d.p.exp * 100)}% всех трат.</p>
        <div class="story__rows" style="--i:4">${d.cats.slice(1, 4).map((x, j) => html`<div class="story__row"><div><span>${x.cat.name}</span><b class="num">${fmt(x.v)}</b></div><div class="progress"><i style=${`--p:${x.v / d.cats[0].v};--delay:${600 + j * 120}ms`}></i></div></div>`)}</div>` },
    d.topDay && { tone: 'teal', body: html`<span class="story__eyebrow" style="--i:0">Самый дорогой день</span>
        <div class="story__big" style="--i:1">${dateLong(d.topDay[0])}</div>
        <p class="story__txt" style="--i:2">${cap(WD_LONG[parse(d.topDay[0]).getDay()])}, <b>${money(d.topDay[1])}</b> без учёта аренды.</p>
        <div class="story__rows" style="--i:3">${d.topDayItems.map(t => html`<div class="story__row"><div><span>${t.note || catOf(t.cat).name}</span><b class="num">${fmt(t.amount)}</b></div></div>`)}</div>` },
    d.prev && { tone: d.p.exp <= d.prev.exp ? 'green' : 'pink', body: html`<span class="story__eyebrow" style="--i:0">По сравнению с ${M_INS[(k - 1) % 12]}</span>
        <div class="story__big" style="--i:1">${d.p.exp <= d.prev.exp ? '−' : '+'}${Math.abs(Math.round((d.p.exp - d.prev.exp) / d.prev.exp * 100))}%</div>
        <p class="story__txt" style="--i:2">${d.p.exp <= d.prev.exp ? html`Вы потратили на <b>${money(d.prev.exp - d.p.exp)}</b> меньше.` : html`Трат стало больше на <b>${money(d.p.exp - d.prev.exp)}</b>.`}</p>
        <div class="story__cmp" style="--i:3">
          <div><i style=${`--h:${d.prev.exp / Math.max(d.prev.exp, d.p.exp)};--d:500ms`}></i><span>${cap(M_NOM[(k - 1) % 12])}<br /><b class="num">${kfmt(d.prev.exp)}</b></span></div>
          <div><i style=${`--h:${d.p.exp / Math.max(d.prev.exp, d.p.exp)};--d:700ms`}></i><span>${cap(M_NOM[m])}<br /><b class="num">${kfmt(d.p.exp)}</b></span></div>
        </div>` },
    (d.taxi || d.taxiPrev) && { tone: 'orange', body: html`<span class="story__eyebrow" style="--i:0">Такси</span>
        <div class="story__road" style="--i:1"><span class="ms">local_taxi</span></div>
        <div class="story__big" style="--i:2"><${Big} v=${d.taxi} /></div>
        <p class="story__txt" style="--i:3">${d.taxiPrev ? (d.taxi < d.taxiPrev ? html`На <b>${Math.round((1 - d.taxi / d.taxiPrev) * 100)}% меньше</b>, чем в ${M_PREP[(k - 1) % 12]}.` : html`На <b>${Math.round((d.taxi / d.taxiPrev - 1) * 100)}% больше</b>, чем в ${M_PREP[(k - 1) % 12]}.`) : 'Первый месяц с такси в учёте.'}</p>
        ${d.ch && html`<p class="story__txt" style="--i:4;font-size:17px">${d.taxi <= d.ch.limit ? 'Уложились в лимит ' : 'Лимит превышен: '}${money(d.ch.limit)}</p>`}` },
    (d.instPaid || d.depGrow) && { tone: 'green', body: html`<span class="story__eyebrow" style="--i:0">Рассрочки и депозит</span>
        <div class="story__icon" style="--i:1"><span class="ms">account_balance</span></div>
        <div class="story__big" style="--i:2">+<${Big} v=${Math.round(d.depGrow)} /></div>
        <p class="story__txt" style="--i:3">Депозит вырос, из них <b>${money(d.depInt)}</b> — проценты, которые вы не заработали руками.</p>
        ${d.instPaid > 0 && html`<p class="story__txt" style="--i:4;font-size:17px">По рассрочкам выплачено ${money(d.instPaid)}.</p>`}` },
    d.badges.length && { tone: 'indigo', body: html`<span class="story__eyebrow" style="--i:0">Награды за ${M_NOM[m]}</span>
        <div class="story__big" style="--i:1">${d.badges.length} ${plural(d.badges.length, 'награда', 'награды', 'наград')}</div>
        <div class="story__badges" style="--i:2">${d.badges.map(([a, r], j) => html`<div style=${`--i:${j};display:grid;justify-items:center;gap:6px;width:84px;text-align:center;font-size:13px`}><${AchBadge} a=${a} r=${r} size=${68} /><span>${a.n}</span></div>`)}</div>` },
    { tone: saved > 0 ? 'green' : 'pink', body: html`<span class="story__eyebrow" style="--i:0">${saved > 0 ? 'Отложено' : 'Ушли в минус на'}</span>
        <div class="story__big" style="--i:1"><${Big} v=${Math.abs(saved)} /></div>
        <p class="story__txt" style="--i:2">${saved > 0 ? html`Это <b>${rate}% дохода</b>. ${rate >= 20 ? 'Отличный месяц.' : 'Хорошая база на следующий месяц.'}` : 'Попробуйте челлендж на самую большую категорию.'}</p>
        <button class="btn" style="--i:3" onClick=${e => { e.stopPropagation(); onClose(); }}>Готово</button>` },
  ].filter(Boolean);
  const last = slides.length - 1;
  const go = di => { buzz(4); setI(x => { const n = x + di; if (n > last) { onClose(); return x; } return Math.max(0, n); }); };
  const hold = useRef(0);
  const cur = slides[i];
  return html`<div class="recap">
    <div class=${'story story--' + cur.tone + (paused ? ' is-paused' : '')}>
      <div class="story__bars">${slides.map((_, j) => html`<span class=${j < i ? 'is-done' : j === i ? 'is-cur' : ''}><i key=${'b' + i + j} onAnimationEnd=${() => j === i && i < last && go(1)}></i></span>`)}</div>
      <button class="circle-btn story__close" aria-label="Закрыть итоги" onClick=${onClose}><${Icon} n="close" /></button>
      <div class="story__body" key=${'s' + i}>${cur.body}</div>
      <div class="story__tap" onPointerDown=${() => { hold.current = Date.now(); setPaused(true); }} onPointerUp=${() => setPaused(false)} onPointerLeave=${() => setPaused(false)}>
        <button aria-label="Назад" onClick=${() => Date.now() - hold.current < 250 && go(-1)}></button>
        <button aria-label="Дальше" onClick=${() => Date.now() - hold.current < 250 && go(1)}></button>
      </div>
    </div>
  </div>`;
}
