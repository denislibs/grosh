import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon, Sq, Chevron, Screen, useCountUp } from '@grosh/ui-kit';
import { M_GEN, M_NOM, TODAY, cap, dateLong, diffDays, fmt, initials, money, pRange, plural } from '../lib/dates.js';
import { depState, effFromNom, fmtRate, instState } from '../lib/finance.js';
import { catOf, ui } from '../state/store.js';
import { Ledger } from '../components/Ledger.js';

export function ChallengeCell({ ch, c, i }) {
  const cat = catOf(ch.cat);
  const [a, b] = pRange(c.cur, c.ms);
  const spent = c.txs.filter(t => t.cat === ch.cat && t.type === 'expense' && t.date >= a && t.date <= b).reduce((s, t) => s + t.amount, 0);
  const p = spent / ch.limit, left = diffDays(TODAY, b);
  const col = p > 1 ? 'var(--red)' : p > .8 ? 'var(--orange)' : 'var(--green)';
  const state = p > 1 ? `Превышен на ${money(spent - ch.limit)}` : `Осталось ${money(ch.limit - spent)} · ${left} ${plural(left, 'день', 'дня', 'дней')}`;
  return html`<button class="cell cell--icon" onClick=${() => ui.sheet({ kind: 'challenge', ch })}>
    <${Sq} c=${cat} />
    <div class="chal">
      <div class="chal__row"><span>${cat.name}</span><span class="cell__value t-subhead">${fmt(spent)} из ${fmt(ch.limit)}</span></div>
      <div class="progress" style=${`--p:${Math.min(1, p)};--c:${col};--delay:${i * 100}ms`}><i></i></div>
      <span class="chal__state" style=${p > .8 ? 'color:' + col : 'color:var(--label-2)'}>${state}</span>
    </div>
  </button>`;
}
export function Home({ s, c }) {
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState(''), [qa, setQa] = useState(false);
  const ql = q.trim().toLowerCase();
  const found = ql ? c.txs.filter(t => (t.note || '').toLowerCase().includes(ql) || catOf(t.cat).name.toLowerCase().includes(ql) || String(t.amount).includes(ql.replace(/\s/g, ''))) : c.txs;
  const p = c.per.get(c.cur) || { exp: 0, inc: 0 };
  const bal = useCountUp(c.inc - c.exp - c.tr, { duration: 1100, fromZero: true });
  const deps = (s.deposits || []).filter(d => !d.closedAt).map(d => ({ d, st: depState(d, c.txs) }));
  const insts = (s.installments || []).map(it => ({ it, st: instState(it, c.txs) }));
  const depTotal = deps.reduce((a, x) => a + x.st.bal, 0), debt = insts.reduce((a, x) => a + x.st.left, 0);
  const active = insts.filter(x => !x.st.done), closedN = insts.length - active.length;
  const [a, b] = pRange(c.cur, c.ms);
  const dayN = diffDays(a, TODAY) + 1, dayAll = diffDays(a, b) + 1;
  const recapKey = c.cur - 1;
  const showRecap = c.per.has(recapKey) && s.meta.recapSeen !== recapKey;
  const curM = c.cur % 12;
  return html`<${Screen} title="Обзор"
    right=${html`<button class="circle-btn" aria-label="Настройки" onClick=${() => ui.page('settings')}><${Icon} n="settings" /></button>`}
    accessory=${html`<button class="avatar" style=${`--c:var(--${s.profile.color})`} aria-label="Профиль" onClick=${() => ui.page('profile')}>${initials(s.profile.name) || html`<${Icon} n=\"person\" fill />`}</button>`}>
    <div class="split">
      <div class="col">
        <div class="hero">
          <span class="metric__label">Свободные деньги</span>
          <span class="hero__v">${fmt(bal)}<small>₸</small></span>
          <span class="secondary t-subhead">${cap(M_NOM[curM])}: день ${dayN} из ${dayAll}</span>
        </div>
        <div class="group">
          <div class="cell cell--icon"><span class="sq" style="--c:var(--green)"><${Icon} n="south_west" /></span><span class="cell__main"><span class="cell__title">Доход за ${M_NOM[curM]}</span></span><span class="amt amt--in">+${fmt(p.inc)} ₸</span></div>
          <div class="cell cell--icon"><span class="sq" style="--c:var(--red)"><${Icon} n="north_east" /></span><span class="cell__main"><span class="cell__title">Расход за ${M_NOM[curM]}</span></span><span class="amt">−${fmt(p.exp)} ₸</span></div>
          <div class="cell cell--icon"><span class="sq" style="--c:var(--green)"><${Icon} n="account_balance" /></span><span class="cell__main"><span class="cell__title">На депозитах</span></span><span class="amt">${fmt(depTotal)} ₸</span></div>
          <div class="cell cell--icon"><span class="sq" style="--c:var(--purple)"><${Icon} n="credit_card" /></span><span class="cell__main"><span class="cell__title">Осталось по рассрочкам</span></span><span class="amt">${fmt(debt)} ₸</span></div>
        </div>
        ${showRecap && html`<div class="group"><button class="cell cell--icon" onClick=${() => ui.recap(recapKey)}>
          <span class="sq" style="--c:var(--indigo)"><${Icon} n="auto_awesome" /></span>
          <span class="cell__main"><span class="cell__title">Итоги ${M_GEN[recapKey % 12]}</span><span class="cell__sub">Траты, награды и такси за месяц</span></span><${Chevron} />
        </button></div>`}
        <div class="section">
          <div class="section__header"><span>Челленджи</span></div>
          <div class="group">
            ${s.challenges.map((ch, i) => html`<${ChallengeCell} key=${ch.id} ch=${ch} c=${c} i=${i} />`)}
            <button class="cell more" onClick=${() => ui.sheet({ kind: 'challenge' })}>Новый челлендж</button>
          </div>
          <div class="section__footer">Лимит на категорию в месяц. Уложитесь — получите награду «Укротитель».</div>
        </div>
        <div class="section">
          <div class="section__header"><span>Рассрочки</span><span class="num">${debt ? fmt(debt) + ' ₸' : ''}</span></div>
          <div class="group">
            ${active.map(({ it, st }, i) => { const dl = st.next ? diffDays(TODAY, st.next.date) : 0; return html`<button class="cell cell--icon" key=${it.id} onClick=${() => ui.sheet({ kind: 'inst', it })}>
              <span class="sq" style="--c:var(--purple)"><${Icon} n="credit_card" /></span>
              <div class="chal">
                <div class="chal__row"><span>${it.name}</span><span class="cell__value t-subhead">${st.paidN} из ${it.months}</span></div>
                <div class="progress" style=${`--p:${st.paidN / it.months};--c:var(--purple);--delay:${i * 100}ms`}><i></i></div>
                <span class="chal__state" style=${dl <= 3 ? 'color:var(--orange)' : 'color:var(--label-2)'}>${money(st.next.amount)} · ${dl === 0 ? 'сегодня' : dl === 1 ? 'завтра' : dl <= 3 ? `через ${dl} ${plural(dl, 'день', 'дня', 'дней')}` : dateLong(st.next.date)}</span>
              </div>
            </button>`; })}
            ${closedN > 0 && html`<div class="cell cell--icon"><span class="sq" style="--c:var(--gray)"><${Icon} n="task_alt" /></span><span class="cell__main secondary">Выплачено полностью: ${closedN}</span></div>`}
            <button class="cell more" onClick=${() => ui.sheet({ kind: 'inst' })}>Новая рассрочка</button>
          </div>
          <div class="section__footer">Платёж списывается сам в день оплаты и попадает в расходы.</div>
        </div>
        <div class="section">
          <div class="section__header"><span>Депозиты</span><span class="num">${depTotal ? fmt(depTotal) + ' ₸' : ''}</span></div>
          <div class="group">
            ${deps.map(({ d, st }) => html`<button class="cell cell--icon" key=${d.id} onClick=${() => ui.sheet({ kind: 'dep', d })}>
              <span class="sq" style="--c:var(--green)"><${Icon} n="account_balance" /></span>
              <span class="cell__main"><span class="cell__title">${d.name}</span><span class="cell__sub">${fmtRate(effFromNom(d.rate, d.cap))}% ГЭСВ · <span style="color:var(--green)">+${fmt(st.interest)} ₸</span></span></span>
              <span class="amt">${fmt(st.bal)} ₸</span><${Chevron} />
            </button>`)}
            <button class="cell more" onClick=${() => ui.sheet({ kind: 'dep' })}>Открыть депозит</button>
          </div>
          <div class="section__footer">Пополнение — это перевод, а не расход: оно уменьшает свободные деньги, но не попадает в статистику трат.</div>
        </div>
      </div>
      <div class="col" style="gap:20px">
        <div class=${'search' + (qa || q ? ' is-active' : '')}>
          <label class=${'search__field' + (q ? ' has-value' : '')} for="home-search"><${Icon} n="search" />
            <input id="home-search" type="search" placeholder="Поиск по заметкам и категориям" value=${q} onInput=${e => setQ(e.target.value)} onFocus=${() => setQa(true)} onBlur=${() => setQa(false)} />
            <button type="button" class="input__clear" aria-label="Очистить" onMouseDown=${e => e.preventDefault()} onClick=${() => setQ('')}><${Icon} n="close" /></button>
          </label>
          <button class="search__cancel" onMouseDown=${e => e.preventDefault()} onClick=${() => { setQ(''); setQa(false); document.activeElement?.blur(); }}>Отмена</button>
        </div>
        ${ql && !found.length ? html`<div class="empty"><${Icon} n="search" /><b>Ничего не нашлось</b><p>Попробуйте другое слово или сумму без пробелов.</p></div>` : html`<${Ledger} txs=${found} limit=${ql ? 999 : limit} />`}
        ${!ql && new Set(c.txs.map(t => t.date)).size > limit && html`<div class="group"><button class="cell more" onClick=${() => setLimit(l => l + 14)}>Показать ещё</button></div>`}
      </div>
    </div>
  <//>`;
}
