import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Sheet, SheetNav, Spinner, useTheme } from '@grosh/ui-kit';
import { config } from '../config.js';
import { renderGoogleButton } from '../lib/google.js';

/** Шторка «Вход через Google»: официальная кнопка Google и запасной переход на страницу Google. */
export function GoogleSheet({ onCredential, onRedirect, onClose }) {
  const { resolved } = useTheme();
  const slot = useRef();
  const [state, setState] = useState('loading'); // loading | ready | failed
  useEffect(() => {
    renderGoogleButton(slot.current, { clientId: config.googleClientId, dark: resolved === 'dark', onCredential })
      .then(() => setState('ready'), () => setState('failed'));
  }, []);
  return html`<div class="auth-layer"><${Sheet} auto onClose=${onClose}>${close => html`
    <${SheetNav} title="Вход через Google" onCancel=${close} />
    <div class="sheet__body google-sheet">
      <p class="google-sheet__text">Выберите аккаунт Google — Грош получит только имя и почту.</p>
      <div class="google-sheet__slot" ref=${slot} hidden=${state === 'failed'}>${state === 'loading' && html`<${Spinner} />`}</div>
      ${state === 'failed' && html`<p class="google-sheet__text">Не удалось загрузить кнопку Google. Проверьте интернет или войдите через страницу Google.</p>`}
      <button class="btn btn--plain" onClick=${onRedirect}>Открыть страницу Google</button>
    </div>`}<//></div>`;
}
