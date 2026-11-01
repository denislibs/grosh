import { html } from 'htm/preact';
import { useRef, useState } from 'preact/hooks';
import { Avatar, Icon, Spinner } from '@grosh/ui-kit';
import { initials } from '../lib/dates.js';
import { photoFromFile, photoMessage, uploadPhoto } from '../lib/image.js';
import { buzz, ui } from '../state/store.js';

/** Аватар пользователя: фото, иначе инициалы на цвете профиля, иначе силуэт. */
export const UserAvatar = ({ p, size, onClick, label }) => html`<${Avatar} color=${p.color} size=${size} src=${p.photo} onClick=${onClick} label=${label}>
  ${initials(p.name) || html`<${Icon} n="person" fill />`}
<//>`;

/** Кнопка выбора фото: галерея или камера → сжатие → загрузка. onPhoto получает ссылку; prev — прежнее фото (удалится). */
export function PhotoPicker({ prev, onPhoto, children, cls = 'btn btn--plain' }) {
  const input = useRef();
  const [busy, setBusy] = useState(false);
  const pick = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onPhoto(await uploadPhoto(await photoFromFile(file), prev)); buzz(8); }
    catch (err) { ui.toast(photoMessage(err), null, 'error'); }
    finally { setBusy(false); }
  };
  return html`<button class=${cls} disabled=${busy} onClick=${() => input.current.click()}>${busy ? html`<${Spinner} />Загружаем…` : children}</button>
    <input ref=${input} type="file" accept="image/*" hidden onChange=${pick} />`;
}
