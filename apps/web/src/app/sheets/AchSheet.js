import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';
import { Icon, SheetNav } from '@grosh/ui-kit';
import { M_NOM, cap, dateLong, fmt, iso, kfmt } from '../lib/dates.js';
import { ACH_BY, TIER_NAMES, progressText, tierClass } from '../lib/achievements.js';
import { store } from '../state/store.js';
import { AchBadge } from '../components/AchBadge.js';

export function AchSheet({ id, res, close }) {
  const a = ACH_BY[id], r = res[id], s = store.s;
  const hidden = a.hidden && !r.tier;
  const meta = s.meta.ach[id];
  const ref = useRef();
  const tilt = e => { const el = ref.current; if (!el) return; const b = el.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5; el.style.transform = `rotateY(${x * 36}deg) rotateX(${-y * 36}deg)`; };
  const inShow = s.profile.showcase.includes(id);
  const toggleShow = () => store.set(st => { const sc = st.profile.showcase.filter(x => x !== id); if (!inShow) sc.unshift(id); return { profile: { ...st.profile, showcase: sc.slice(0, 3) } }; });
  return html`<${SheetNav} title="" onCancel=${close} cancel="Закрыть" />
    <div class="sheet__body">
      <div class="ach-hero" onPointerMove=${tilt} onPointerLeave=${() => ref.current && (ref.current.style.transform = '')}>
        <div ref=${ref} style="transition:transform 200ms ease-out"><${AchBadge} a=${a} r=${r} size=${140} /></div>
        <h2 class="t-title2">${hidden ? 'Секретная награда' : a.n}</h2>
        <p class="secondary">${hidden ? 'Условие откроется вместе с наградой. Попробуйте что-нибудь необычное.' : a.d}</p>
      </div>
      <div class="group">
        ${(r.tier || r.count) && meta?.at ? html`<div class="cell"><span class="cell__main">Получена</span><span class="cell__value">${dateLong(iso(new Date(meta.at)))}</span></div>` : ''}
        ${!hidden && !a.monthly && a.tiers.length > 1 ? a.tiers.map((t, i) => html`<div class="cell"><${Icon} n=${r.value >= t ? 'check_circle' : 'radio_button_unchecked'} fill=${r.value >= t} style=${'color:' + (r.value >= t ? 'var(--green)' : 'var(--label-3)')} /><span class="cell__main">${cap(TIER_NAMES[tierClass(a, i + 1)])}</span><span class="cell__value">${a.unit === '₸' ? kfmt(t) : fmt(t)} ${a.unit || ''}</span></div>`) : ''}
        ${!hidden && html`<div class="cell"><span class="cell__main">Прогресс</span><span class="cell__value">${progressText(a, r)}</span></div>`}
        ${a.monthly && r.count ? html`<div class="cell"><span class="cell__main">Месяцы</span><span class="cell__value">${r.periods.map(k => M_NOM[k % 12]).join(', ')}</span></div>` : ''}
      </div>
      ${(r.tier || r.count) ? html`<button class="btn btn--tinted" onClick=${toggleShow}>${inShow ? 'Убрать из витрины' : 'Показать в профиле'}</button>` : ''}
    </div>`;
}
