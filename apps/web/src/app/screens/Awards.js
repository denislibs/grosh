import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon, Seg, Screen } from '@grosh/ui-kit';
import { cap, plural } from '../lib/dates.js';
import { ACH, GROUPS, TIER_NAMES, progressText, streakNow, tierClass } from '../lib/achievements.js';
import { ui } from '../state/store.js';
import { AchBadge } from '../components/AchBadge.js';

export function Awards({ s, c, res }) {
  const [filter, setFilter] = useState('all');
  const got = ACH.filter(a => res[a.id].tier || res[a.id].count).length;
  const streak = streakNow(c);
  const pct = got / ACH.length;
  const has = a => res[a.id].tier || res[a.id].count;
  const show = a => filter === 'all' || (filter === 'got' ? has(a) : !has(a));
  const C = +(2 * Math.PI * 42).toFixed(1);
  let idx = 0;
  return html`<${Screen} title="Награды">
    <div class="card award-sum">
      <div class="big-ring"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="42" style="stroke:var(--fill-3)" /><circle cx="48" cy="48" r="42" stroke-linecap="round" stroke-dasharray=${C} style=${`stroke:var(--orange);stroke-dashoffset:${C * (1 - pct)};--len:${C};animation:ring-in 1.2s var(--ease-out) both`} /></svg><b>${got}<small>из ${ACH.length}</small></b></div>
      <div style="display:grid;gap:4px">
        <b class="t-headline">${pct < .25 ? 'Коллекция только начинается' : pct < .8 ? 'Хорошая коллекция' : 'Почти всё собрано'}</b>
        <span class="secondary t-subhead">Награды выдаются автоматически, когда вы ведёте учёт и экономите.</span>
        <span class="t-subhead" style="color:var(--orange);font-weight:600;display:flex;align-items:center;gap:4px"><${Icon} n="local_fire_department" fill style="font-size:18px" />${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд</span>
      </div>
    </div>
    <${Seg} items=${[['all', 'Все'], ['got', 'Получены'], ['todo', 'В процессе']]} value=${filter} onChange=${setFilter} />
    ${GROUPS.map(([g, title]) => {
      const list = ACH.filter(a => a.g === g && show(a));
      if (!list.length) return null;
      return html`<div class="section" key=${g + filter}>
        <div class="section__header"><span>${title}</span><span>${list.filter(has).length} из ${list.length}</span></div>
        <div class="group badges stagger">${list.map(a => {
          const r = res[a.id], tier = r.tier, hidden = a.hidden && !tier;
          return html`<button class="badge-cell" style=${'--i:' + idx++} onClick=${() => ui.sheet({ kind: 'ach', id: a.id, auto: true })}>
            <${AchBadge} a=${a} r=${r} />
            <b>${hidden ? 'Секрет' : a.n}</b>
            <small>${hidden ? 'откройте случайно' : tier ? (a.monthly ? `×${r.count}` : cap(TIER_NAMES[tierClass(a, tier)])) : progressText(a, r)}</small>
          </button>`;
        })}</div>
      </div>`;
    })}
  <//>`;
}
