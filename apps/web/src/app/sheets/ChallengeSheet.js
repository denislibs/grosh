import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Sq, SheetNav } from '@grosh/ui-kit';
import { fmt, money, uid } from '../lib/dates.js';
import { buzz, catOf, mutate, store, ui } from '../state/store.js';

export function ChallengeSheet({ ch, close }) {
  const s = store.s;
  const cats = s.categories.filter(c => c.type === 'expense' && !c.archived);
  const [cat, setCat] = useState(ch?.cat || (s.challenges.some(x => x.cat === 'taxi') ? null : 'taxi'));
  const [limit, setLimit] = useState(ch ? String(ch.limit) : '20000');
  const save = () => {
    const l = parseInt(limit, 10);
    if (!cat) return ui.toast('Выберите категорию', null, 'error');
    if (!l || l < 100) return ui.toast('Лимит должен быть от 100 ₸', null, 'error');
    close();
    mutate(st => ({ challenges: ch ? st.challenges.map(x => (x.id === ch.id ? { ...x, cat, limit: l } : x)) : [...st.challenges, { id: uid(), cat, limit: l, createdAt: Date.now() }] }));
    ui.toast(ch ? 'Челлендж обновлён' : `${catOf(cat).name}: до ${money(l)} в месяц`);
  };
  return html`<${SheetNav} title=${ch ? 'Челлендж' : 'Новый челлендж'} onCancel=${close} done=${ch ? 'Готово' : 'Начать'} onDone=${save} />
    <div class="sheet__body">
      <div class="section"><div class="section__header">Категория</div>
        <div class="group" style="padding:14px 8px"><div class="picks">${cats.map(c => html`<button class="pick" style=${`--c:var(--${c.color})`} aria-pressed=${String(cat === c.id)} onClick=${() => { buzz(5); setCat(c.id); }}><${Sq} c=${c} size="md" /><span>${c.name}</span></button>`)}</div></div></div>
      <div class="section"><div class="section__header">Лимит в месяц, ₸</div>
        <div class="group"><input class="field num" id="ch-limit" inputmode="numeric" value=${limit} onInput=${e => setLimit(e.target.value.replace(/\D/g, ''))} /></div>
        <div class="group" style="padding:6px 16px;margin-top:10px"><div class="slider-row"><span class="t-footnote">5к</span>
          <input type="range" class="slider" id="ch-slider" aria-label="Лимит" min="5000" max="100000" step="1000" value=${Math.min(100000, Math.max(5000, +limit || 5000))} style=${`--p:${(Math.min(100000, Math.max(5000, +limit || 5000)) - 5000) / 950}%`} onInput=${e => { setLimit(e.target.value); buzz(2); }} />
          <span class="t-footnote">100к</span></div></div>
        <div class="row-scroll" style="margin-top:10px">${[10000, 20000, 30000, 50000].map(v => html`<button class="capsule" aria-pressed=${String(+limit === v)} onClick=${() => setLimit(String(v))}>${fmt(v)} ₸</button>`)}</div>
      </div>
      ${ch && html`<div class="group"><button class="cell cell--destructive" onClick=${() => { close(); store.set(st => ({ challenges: st.challenges.filter(x => x.id !== ch.id) })); ui.toast('Челлендж удалён'); }}>Удалить челлендж</button></div>`}
    </div>`;
}
