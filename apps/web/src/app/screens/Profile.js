import { html } from 'htm/preact';
import { UserAvatar } from '../components/UserAvatar.js';
import { Icon, Sq, Page } from '@grosh/ui-kit';
import { TODAY, dateLong, diffDays, parse, plural } from '../lib/dates.js';
import { ACH, ACH_BY, streakNow } from '../lib/achievements.js';
import { store, ui } from '../state/store.js';
import { CountUp } from './Stats.js';
import { AchBadge } from '../components/AchBadge.js';

export function Profile({ s, c, res, onClose }) {
  const got = ACH.filter(a => res[a.id].tier || res[a.id].count).length;
  const days = diffDays(c.first, TODAY) + 1;
  const streak = streakNow(c);
  const setName = v => store.set(st => ({ profile: { ...st.profile, name: v.slice(0, 24) || 'Без имени' } }));
  return html`<${Page} title="Профиль" onClose=${onClose}>
    <div class="profile-head">
      <${UserAvatar} p=${s.profile} size="xl" label="Фото и цвет профиля" onClick=${() => ui.sheet({ kind: 'avatar', auto: true })} />
      <input class="name-input" id="profile-name" value=${s.profile.name} onChange=${e => setName(e.target.value.trim())} aria-label="Имя" />
      <span class="secondary t-subhead">Ведёте учёт с ${dateLong(c.first)} ${parse(c.first).getFullYear()}</span>
    </div>
    <div class="group">
      <div class="cell"><span class="cell__main">Дней с Грошем</span><span class="cell__value"><${CountUp} v=${days} /></span></div>
      <div class="cell"><span class="cell__main">Записей</span><span class="cell__value"><${CountUp} v=${c.txs.length} /></span></div>
      <div class="cell"><span class="cell__main">Наград</span><span class="cell__value">${got} из ${ACH.length}</span></div>
      <div class="cell"><span class="cell__main">Серия</span><span class="cell__value">${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд</span></div>
    </div>
    <div class="section"><div class="section__header">Витрина</div>
      <div class="group showcase">${[0, 1, 2].map(i => { const id = s.profile.showcase[i]; const a = id && ACH_BY[id];
        return a && (res[id].tier || res[id].count) ? html`<button class="slot" onClick=${() => ui.sheet({ kind: 'showcase', slot: i, auto: true })}><${AchBadge} a=${a} r=${res[id]} size=${64} /><b>${a.n}</b></button>`
          : html`<button class="slot slot--empty" onClick=${() => ui.sheet({ kind: 'showcase', slot: i, auto: true })}><span class="ring-empty"><${Icon} n="add" /></span><span>Выбрать</span></button>`; })}</div>
      </div>
    ${s.profile.account ? html`<div class="group"><div class="cell cell--icon"><${Sq} icon="cloud_sync" color="green" /><span class="cell__main"><span>${s.profile.account.email || 'Вход через ' + s.profile.account.provider}</span><span class="cell__sub">Синхронизация включена</span></span></div></div>`
      : html`<button class="btn btn--tinted" onClick=${() => ui.auth('welcome')}>Войти или создать аккаунт</button>`}
  <//>`;
}
