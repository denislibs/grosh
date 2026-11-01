import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Confetti } from '@grosh/ui-kit';
import { ACH_BY, TIER_NAMES, tierClass } from '../lib/achievements.js';
import { buzz } from '../state/store.js';
import { AchBadge } from '../components/AchBadge.js';

export function Unlock({ ids, res, onDone }) {
  const [i, setI] = useState(0), [closing, setClosing] = useState(false);
  const a = ACH_BY[ids[i]], r = res[a.id];
  useEffect(() => { buzz([20, 60, 30, 60, 50]); }, [i]);
  const next = () => { if (i < ids.length - 1) setI(i + 1); else { setClosing(true); setTimeout(onDone, 320); } };
  const tierName = a.monthly ? (r.count > 1 ? `×${r.count}` : '') : a.tiers.length > 1 ? TIER_NAMES[tierClass(a, r.tier)] : '';
  return html`<div class=${'unlock' + (closing ? ' is-closing' : '')} onClick=${e => e.target === e.currentTarget && next()}>
    <div class="unlock__card" key=${a.id}>
      <${Confetti} />
      ${a.taxi && html`<span class="ms unlock__taxi" aria-hidden="true">local_taxi</span>`}
      <${AchBadge} a=${a} r=${{ ...r, tier: r.tier || 1, next: null }} size=${120} />
      <span class="t-footnote" style="color:var(--orange);font-weight:600;text-transform:uppercase">Новая награда${tierName ? ' · ' + tierName : ''}</span>
      <h2 class="t-title2">${a.n}</h2>
      <p>${a.d}</p>
      <button class="btn btn--filled btn--block" style="margin-top:10px" onClick=${next}>${i < ids.length - 1 ? `Дальше (ещё ${ids.length - 1 - i})` : 'Отлично'}</button>
    </div>
  </div>`;
}
