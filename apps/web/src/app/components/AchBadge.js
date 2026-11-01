import { html } from 'htm/preact';
import { Badge } from '@grosh/ui-kit';
import { tierClass } from '../lib/achievements.js';

/** Награда «Гроша» → универсальный бейдж kit'а. a — описание награды, r — её состояние. */
export function AchBadge({ a, r, size = 72, style = '' }) {
  const tier = r.tier, hidden = a.hidden && !tier;
  const progress = a.monthly ? (tier ? 1 : 0) : r.next == null ? 1 : Math.min(1, r.value / r.next);
  return html`<${Badge} icon=${hidden ? 'lock' : a.i} tier=${tierClass(a, tier)} progress=${progress} count=${r.count} size=${size} style=${style} />`;
}
