import { html } from 'htm/preact';
import { UserAvatar } from '../components/UserAvatar.js';
import { useState } from 'preact/hooks';
import { Icon, Sq, Chevron, Screen, Menu, useCountUp } from '@grosh/ui-kit';
import { M_GEN, M_NOM, TODAY, cap, dateLong, diffDays, fmt, money, pRange, plural } from '../lib/dates.js';
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
// Траты месяца по категориям — для колонки справа на десктопе
function CatSpend({ c, a, b, month }) {
  const by = new Map();
  for (const t of c.txs) if (t.type === 'expense' && t.date >= a && t.date <= b) by.set(t.cat, (by.get(t.cat) || 0) + t.amount);
  const rows = [...by].sort((x, y) => y[1] - x[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0), top = rows[0]?.[1] || 1;
  return html`<div class="section">
    <div class="section__header"><span>Траты за ${month}</span><span class="num">${total ? fmt(total) + ' ₸' : ''}</span></div>
    <div class="group">
      ${rows.length ? rows.slice(0, 5).map(([id, v], i) => { const cat = catOf(id); return html`<div class="cell cell--icon" key=${id}>
        <${Sq} c=${cat} />
        <div class="chal">
          <div class="chal__row"><span>${cat.name}</span><span class="cell__value t-subhead">${fmt(v)} ₸</span></div>
          <div class="progress" style=${`--p:${v / top};--c:var(--${cat.color});--delay:${i * 80}ms`}><i></i></div>
        </div></div>`; })
        : html`<div class="cell"><span class="cell__main secondary">В этом месяце трат пока нет</span></div>`}
      <button class="cell more" onClick=${() => { location.hash = 'stats'; }}>Вся статистика</button>
    </div>
  </div>`;
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
  const curM = c.cur % 12, month = M_NOM[curM];

  const search = (id, hint = 'Поиск по заметкам и категориям') => html`<div class=${'search' + (qa || q ? ' is-active' : '')}>
    <label class=${'search__field' + (q ? ' has-value' : '')} for=${id}><${Icon} n="search" />
      <input id=${id} type="search" placeholder=${hint} value=${q} onInput=${e => setQ(e.target.value)} onFocus=${() => setQa(true)} onBlur=${() => setQa(false)} />
      <button type="button" class="input__clear" aria-label="Очистить" onMouseDown=${e => e.preventDefault()} onClick=${() => setQ('')}><${Icon} n="close" /></button>
    </label>
    <button class="search__cancel" onMouseDown=${e => e.preventDefault()} onClick=${() => { setQ(''); setQa(false); document.activeElement?.blur(); }}>Отмена</button>
  </div>`;
  // планы: на десктопе пустые разделы сворачиваются в один список действий
  const plans = [
    !s.challenges.length && { icon: 'flag', color: 'yellow', title: 'Новый челлендж', sub: 'Лимит на категорию в месяц', run: () => ui.sheet({ kind: 'challenge' }) },
    !insts.length && { icon: 'credit_card', color: 'purple', title: 'Новая рассрочка', sub: 'Платежи спишутся сами', run: () => ui.sheet({ kind: 'inst' }) },
    !deps.length && { icon: 'account_balance', color: 'green', title: 'Открыть депозит', sub: 'Проценты считаются каждый день', run: () => ui.sheet({ kind: 'dep' }) },
  ].filter(Boolean);
  const kpi = (label, icon, color, value, cls = '') => html`<div class=${'kpi ' + cls}>
    <span class="kpi__label"><span class="kpi__dot" style=${`--c:var(--${color})`}><${Icon} n=${icon} /></span>${label}</span>
    <span class="kpi__v">${value}<small>₸</small></span>
  </div>`;

  return html`<${Screen} title="Обзор"
    right=${html`<span class="narrow-only"><button class="circle-btn" aria-label="Настройки" onClick=${() => ui.page('settings')}><${Icon} n="settings" /></button></span>`}
    accessory=${html`<div class="home-head">
      <div class="wide-only">${search('home-search-wide', 'Поиск записей')}</div>
      <span class="narrow-only"><${UserAvatar} p=${s.profile} label="Профиль" onClick=${() => ui.page('profile')} /></span>
      <span class="wide-only"><${Menu} label="Профиль и настройки" triggerClass="avatar-menu" title=${s.profile.name || s.profile.account?.email}
        items=${[{ label: 'Профиль', icon: 'person', onSelect: () => ui.page('profile') }, { label: 'Настройки', icon: 'settings', onSelect: () => ui.page('settings') }]}>
        <${UserAvatar} p=${s.profile} /><//></span>
    </div>`}>
    <div class="dash">
      <div class="narrow-only">
        <div class="hero">
          <span class="metric__label">Свободные деньги</span>
          <span class="hero__v">${fmt(bal)}<small>₸</small></span>
          <span class="secondary t-subhead">${cap(month)}: день ${dayN} из ${dayAll}</span>
        </div>
        <div class="group">
          <div class="cell cell--icon"><span class="sq" style="--c:var(--green)"><${Icon} n="south_west" /></span><span class="cell__main"><span class="cell__title">Доход за ${month}</span></span><span class="amt amt--in">+${fmt(p.inc)} ₸</span></div>
          <div class="cell cell--icon"><span class="sq" style="--c:var(--red)"><${Icon} n="north_east" /></span><span class="cell__main"><span class="cell__title">Расход за ${month}</span></span><span class="amt">−${fmt(p.exp)} ₸</span></div>
          <div class="cell cell--icon"><span class="sq" style="--c:var(--green)"><${Icon} n="account_balance" /></span><span class="cell__main"><span class="cell__title">На депозитах</span></span><span class="amt">${fmt(depTotal)} ₸</span></div>
          <div class="cell cell--icon"><span class="sq" style="--c:var(--purple)"><${Icon} n="credit_card" /></span><span class="cell__main"><span class="cell__title">Осталось по рассрочкам</span></span><span class="amt">${fmt(debt)} ₸</span></div>
        </div>
      </div>

      <div class="wide-only"><div class="kpis">
        <div class="kpi kpi--main">
          <span class="kpi__label">Свободные деньги</span>
          <span class="kpi__v">${fmt(bal)}<small>₸</small></span>
          <div class="kpi__month"><span>${cap(month)}: день ${dayN} из ${dayAll}</span><div class="kpi__bar"><i style=${`width:${Math.round(dayN / dayAll * 100)}%`}></i></div></div>
        </div>
        ${kpi('Доход', 'south_west', 'green', '+' + fmt(p.inc), 'kpi--in')}
        ${kpi('Расход', 'north_east', 'red', '−' + fmt(p.exp))}
        ${kpi('Депозиты', 'account_balance', 'green', fmt(depTotal))}
        ${kpi('Рассрочки', 'credit_card', 'purple', fmt(debt))}
      </div></div>

      <div class="dash__l">
        ${showRecap && html`<div class="group dash__recap"><button class="cell cell--icon" onClick=${() => ui.recap(recapKey)}>
          <span class="sq" style="--c:var(--indigo)"><${Icon} n="auto_awesome" /></span>
          <span class="cell__main"><span class="cell__title">Итоги ${M_GEN[recapKey % 12]}</span><span class="cell__sub">Траты, награды и такси за месяц</span></span><${Chevron} />
        </button></div>`}
        <div class="feed">
          <div class="section__header wide-only-flex"><span>${ql ? 'Найдено' : 'Последние записи'}</span><span class="num">${ql ? found.length : ''}</span></div>
          <div class="narrow-only">${search('home-search')}</div>
          ${ql && !found.length ? html`<div class="empty"><${Icon} n="search" /><b>Ничего не нашлось</b><p>Попробуйте другое слово или сумму без пробелов.</p></div>` : html`<${Ledger} txs=${found} limit=${ql ? 999 : limit} />`}
          ${!ql && new Set(c.txs.map(t => t.date)).size > limit && html`<div class="group"><button class="cell more" onClick=${() => setLimit(l => l + 14)}>Показать ещё</button></div>`}
        </div>
      </div>

      <div class="dash__r">
        <div class="wide-only"><${CatSpend} c=${c} a=${a} b=${b} month=${month} /></div>
        <div class="plans">
          <div class=${'section' + (s.challenges.length ? '' : ' is-empty')}>
            <div class="section__header"><span>Челленджи</span></div>
            <div class="group">
              ${s.challenges.map((ch, i) => html`<${ChallengeCell} key=${ch.id} ch=${ch} c=${c} i=${i} />`)}
              <button class="cell more" onClick=${() => ui.sheet({ kind: 'challenge' })}>Новый челлендж</button>
            </div>
            <div class="section__footer">Лимит на категорию в месяц. Уложитесь — получите награду «Укротитель».</div>
          </div>
          <div class=${'section' + (insts.length ? '' : ' is-empty')}>
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
          <div class=${'section' + (deps.length ? '' : ' is-empty')}>
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
          ${plans.length > 0 && html`<div class="wide-only"><div class="section">
            <div class="section__header"><span>Добавить</span></div>
            <div class="group">${plans.map(x => html`<button class="cell cell--icon" key=${x.title} onClick=${x.run}>
              <span class="sq" style=${`--c:var(--${x.color})`}><${Icon} n=${x.icon} /></span>
              <span class="cell__main"><span class="cell__title">${x.title}</span><span class="cell__sub">${x.sub}</span></span><${Chevron} />
            </button>`)}</div>
          </div></div>`}
        </div>
      </div>
    </div>
  <//>`;
}
