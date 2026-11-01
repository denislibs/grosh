import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon, Sq, SheetNav } from '@grosh/ui-kit';
import { uid } from '../lib/dates.js';
import { COLORS, ICONS } from '../lib/categories.js';
import { store, ui } from '../state/store.js';

export function CategorySheet({ cat, close }) {
  const isNew = !cat.id;
  const [name, setName] = useState(cat.name || ''), [icon, setIcon] = useState(cat.icon || 'more_horiz'), [color, setColor] = useState(cat.color || 'blue');
  const save = () => {
    if (!name.trim()) return ui.toast('Введите название', null, 'error');
    close();
    store.set(st => ({ categories: isNew ? [...st.categories, { id: 'c' + uid().slice(0, 8), type: cat.type, name: name.trim(), icon, color, order: st.categories.length, archived: false }] : st.categories.map(c => (c.id === cat.id ? { ...c, name: name.trim(), icon, color } : c)) }));
    ui.toast(isNew ? 'Категория добавлена' : 'Категория сохранена');
  };
  const archive = () => { close(); store.set(st => ({ categories: st.categories.map(c => (c.id === cat.id ? { ...c, archived: !c.archived } : c)) })); ui.toast(cat.archived ? 'Категория вернулась' : 'Категория в архиве, история сохранена'); };
  return html`<${SheetNav} title=${isNew ? 'Новая категория' : 'Категория'} onCancel=${close} done="Готово" onDone=${save} />
    <div class="sheet__body">
      <div style="display:grid;justify-items:center"><${Sq} c=${{ icon, color }} size="lg" /></div>
      <div class="group"><input class="field" id="cat-name" placeholder="Название" value=${name} onInput=${e => setName(e.target.value)} /></div>
      <div class="group colors">${COLORS.map(p => html`<button class="color" style=${`--c:var(--${p})`} aria-pressed=${String(p === color)} aria-label=${'Цвет ' + p} onClick=${() => setColor(p)}></button>`)}</div>
      <div class="group icons" style=${`--c:var(--${color})`}>${ICONS.map(i => html`<button aria-pressed=${String(i === icon)} onClick=${() => setIcon(i)} aria-label=${i}><${Icon} n=${i} /></button>`)}</div>
      ${!isNew && html`<div class="group"><button class="cell more" onClick=${archive}>${cat.archived ? 'Вернуть из архива' : 'Убрать в архив'}</button></div>`}
    </div>`;
}
