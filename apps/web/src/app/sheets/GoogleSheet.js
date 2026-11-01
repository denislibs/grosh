import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Sheet, SheetNav, Spinner, useTheme } from '@grosh/ui-kit';
import { config } from '../config.js';
import { renderGoogleButton } from '../lib/google.js';

/** Шторка «Вход через Google»: официальная кнопка Google и запасной переход на страницу Google. */
export function GoogleSheet({ onCredential, onRedirect, onClose }) {
  const { resolved } = useTheme();
  const slot = useRef();
  const [state, setState] = useState('loading'); // loading | shown | failed
  useEffect(() => {
    // Google сначала вставляет пустой фрейм и дорисовывает кнопку позже — ждём, пока у него появится высота,
    // а до тех пор место под кнопку фиксированное, чтобы шторка не прыгала
    const ro = new ResizeObserver(() => { if (slot.current?.offsetHeight > 0) { setState('shown'); ro.disconnect(); } });
    ro.observe(slot.current);
    renderGoogleButton(slot.current, { clientId: config.googleClientId, dark: resolved === 'dark', onCredential })
      .catch(() => { ro.disconnect(); setState('failed'); });
    return () => ro.disconnect();
  }, []);
  return html`<div class="auth-layer"><${Sheet} auto onClose=${onClose}>${close => html`
    <${SheetNav} title="Вход через Google" onCancel=${close} />
    <div class="sheet__body google-sheet">
      <p class="google-sheet__text">${state === 'failed'
        ? 'Не удалось загрузить кнопку Google. Проверьте интернет или войдите через страницу Google.'
        : 'Выберите аккаунт Google — Грош получит только имя и почту.'}</p>
      <div class="google-sheet__slot" hidden=${state === 'failed'}>
        <div ref=${slot} class=${'google-sheet__btn' + (state === 'shown' ? ' is-shown' : '')}></div>
        ${state === 'loading' && html`<div class="google-sheet__wait"><${Spinner} /></div>`}
      </div>
      <button class="btn btn--plain" onClick=${onRedirect}>Открыть страницу Google</button>
    </div>`}<//></div>`;
}
