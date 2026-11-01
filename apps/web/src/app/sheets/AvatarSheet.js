import { html } from 'htm/preact';
import { Icon, SheetNav } from '@grosh/ui-kit';
import { COLORS } from '../lib/categories.js';
import { buzz, store, useStore } from '../state/store.js';
import { UserAvatar, PhotoPicker } from '../components/UserAvatar.js';
import { removePhoto } from '../lib/image.js';

export function AvatarSheet({ close }) {
  const p = useStore().profile;
  const setProfile = patch => store.set(st => ({ profile: { ...st.profile, ...patch } }));
  return html`<${SheetNav} title="Фото и цвет" onCancel=${close} cancel="Закрыть" />
    <div class="sheet__body">
      <div class="avatar-edit"><${UserAvatar} p=${p} size="xl" />
        <div class="avatar-edit__actions">
          <${PhotoPicker} prev=${p.photo} onPhoto=${photo => setProfile({ photo })}><${Icon} n="photo_camera" />${p.photo ? 'Другое фото' : 'Выбрать фото'}<//>
          ${p.photo && html`<button class="btn btn--plain" style="color:var(--red)" onClick=${() => { buzz(5); removePhoto(p.photo); setProfile({ photo: null }); }}>Удалить фото</button>`}
        </div>
      </div>
      <div class="section"><div class="section__header">Цвет — когда фото нет</div>
        <div class="group colors">${COLORS.map(c => html`<button class="color" style=${`--c:var(--${c})`} aria-pressed=${String(c === p.color)} aria-label=${'Цвет ' + c} onClick=${() => { buzz(5); setProfile({ color: c }); }}></button>`)}</div>
      </div>
    </div>`;
}
