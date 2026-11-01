import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon, Spinner, Field } from '@grosh/ui-kit';
import { buzz, store, ui } from '../state/store.js';
import { supabase, authMessage, passkeyMessage, passkeySupported } from '../lib/supabase.js';
import { redirectUrl } from '../config.js';
import { GoogleSheet } from '../sheets/GoogleSheet.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const pwScore = p => !p ? 0 : Math.min(4, (p.length >= 8) + (/\d/.test(p)) + (/[a-zа-я]/.test(p) && /[A-ZА-Я]/.test(p)) + (/[^\w\sа-яА-Я]/.test(p)) + (p.length >= 12 ? 1 : 0) - (p.length < 8 ? 1 : 0)) || 1;
export const PW_LEVEL = [null, ['Слабый', 'var(--red)'], ['Средний', 'var(--orange)'], ['Хороший', 'var(--yellow)'], ['Надёжный', 'var(--green)']];
/** required — вход обязателен: закрыть экран без аккаунта нельзя. */
export function Auth({ start = 'welcome', required = false, onClose }) {
  const [step, setStep] = useState(start), [back, setBack] = useState(false), [closing, setClosing] = useState(false);
  const [f, setF] = useState({ email: '', pw: '' });
  const [err, setErr] = useState({}), [busy, setBusy] = useState(false), [shake, setShake] = useState(0);
  const go = (to, isBack = false) => { buzz(4); setBack(isBack); setErr({}); setStep(to); };
  const close = () => { if (closing) return; setClosing(true); store.set(st => ({ meta: { ...st.meta, onboarded: true } })); setTimeout(onClose, 330); };
  const set = k => v => { setF(x => ({ ...x, [k]: v })); if (err[k]) setErr(e => ({ ...e, [k]: null })); };
  const score = pwScore(f.pw);
  const fail = e => { setErr(e); setShake(x => x + 1); buzz([10, 30, 10]); };
  const done = msg => { close(); ui.toast(msg); };
  const offline = () => { ui.toast('Сервер не подключён: добавьте ключи Supabase в .env', null, 'error'); return true; };
  const submit = async kind => {
    const e = {};
    if (kind !== 'newpass' && !EMAIL_RE.test(f.email.trim())) e.email = f.email ? 'Похоже, в адресе опечатка' : 'Введите почту';
    if (kind !== 'forgot' && kind !== 'magic' && f.pw.length < 8) e.pw = f.pw ? 'Пароль короче 8 символов' : 'Введите пароль';
    if (Object.keys(e).length) return fail(e);
    if (!supabase) return offline();
    const email = f.email.trim();
    setBusy(kind);
    try {
      if (kind === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.pw });
        if (error) throw error;
        done(`Вы вошли как ${email}`);
      } else if (kind === 'magic') {
        // ссылка для входа: без пароля, новый адрес сразу получает аккаунт
        localStorage.setItem('grosh.migrate', '1');
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } });
        if (error) { localStorage.removeItem('grosh.migrate'); throw error; }
        go('magic');
      } else if (kind === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
        if (error) throw error;
        go('sent');
      } else if (kind === 'newpass') {
        const { error } = await supabase.auth.updateUser({ password: f.pw });
        if (error) throw error;
        done('Пароль изменён');
      }
    } catch (er) {
      const msg = authMessage(er);
      fail(kind === 'newpass' ? { pw: msg } : { email: msg });
    } finally { setBusy(false); }
  };
  const social = async provider => {
    if (!supabase) return offline();
    setBusy(provider);
    localStorage.setItem('grosh.migrate', '1');
    const { error } = await supabase.auth.signInWithOAuth({ provider: provider.toLowerCase(), options: { redirectTo: redirectUrl() } });
    if (error) { setBusy(false); ui.toast(authMessage(error), null, 'error'); } // при успехе браузер уходит на страницу провайдера
  };
  // вход через Google в шторке поверх приложения; страница Google — запасной путь
  const [gsheet, setGsheet] = useState(false);
  const withGoogle = async (token, nonce) => {
    setBusy('Google');
    localStorage.setItem('grosh.migrate', '1');
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token, nonce });
    setBusy(false);
    if (error) { localStorage.removeItem('grosh.migrate'); return ui.toast(authMessage(error), null, 'error'); }
    setGsheet(false);
    done(`Вы вошли как ${data.user.email}`);
  };
  const signGoogle = () => { if (!supabase) return offline(); buzz(6); setGsheet(true); };
  const btn = (kind, label) => html`<button class="btn btn--filled" disabled=${!!busy} onClick=${() => submit(kind)}>${busy === kind ? html`<${Spinner} size=${20} />` : label}</button>`;
  // вход по ключу доступа: браузер сам предложит сохранённый ключ, почта не нужна
  const signPasskey = async () => {
    if (!supabase) return offline();
    setBusy('passkey');
    const { data, error } = await supabase.auth.signInWithPasskey();
    setBusy(false);
    if (error) { const m = passkeyMessage(error); if (m) ui.toast(m, null, 'error'); return; }
    done(data?.user?.email ? `Вы вошли как ${data.user.email}` : 'Вы вошли');
  };
  const google = html`<button class="btn" style="color:var(--label)" disabled=${!!busy} onClick=${signGoogle}>${busy === 'Google' ? html`<${Spinner} />` : 'Продолжить с Google'}</button>`;
  const passkeyBtn = passkeySupported() && html`<button class="btn btn--apple" disabled=${!!busy} onClick=${signPasskey}>${busy === 'passkey' ? html`<${Spinner} />` : html`<${Icon} n="passkey" />Войти с ключом доступа`}</button>`;
  const stepCls = 'auth__step' + (back ? ' is-back' : '');
  const steps = {
    // один экран и для входа, и для регистрации: ссылка на почту и Google сами создают аккаунт новому человеку
    welcome: html`<div class=${stepCls} key="welcome">
      <div class="auth__hero"><div class="app-icon"><${Icon} n="savings" /></div><h1 class="t-large">Грош</h1><p>Учёт трат в тенге с наградами, челленджами и итогами месяца. Войдите или создайте аккаунт — это один шаг.</p></div>
      <div class="auth__actions">
        ${google}${passkeyBtn}
        <div class="auth__or">или по почте</div>
        <form class=${'auth__fields' + (shake % 2 ? ' is-shake' : '')} key=${'f' + shake} onSubmit=${e => { e.preventDefault(); submit('magic'); }}>
          <${Field} id="auth-email" icon="mail" type="email" autocomplete="email" inputmode="email" placeholder="Почта" value=${f.email} onInput=${set('email')} error=${err.email} />
        </form>
        ${btn('magic', 'Прислать ссылку для входа')}
        <button class="link t-subhead" onClick=${() => go('login')}>Войти с паролем</button>
        ${!required && html`<button class="btn btn--plain" onClick=${close}>Продолжить без аккаунта</button>`}
        <div class="auth__note">Продолжая, вы соглашаетесь с <a href="privacy.html" target="_blank" rel="noopener" style="color:var(--tint)">политикой конфиденциальности</a>.</div>
      </div>
    </div>`,
    login: html`<div class=${stepCls} key="login">
      <div class="auth__head"><h1 class="t-large">Вход с паролем</h1><p>Для тех, кто создавал аккаунт с паролем.</p></div>
      <div class=${'auth__fields' + (shake % 2 ? ' is-shake' : '')} key=${'f' + shake}>
        <${Field} id="login-email" icon="mail" type="email" autocomplete="email" inputmode="email" placeholder="Почта" value=${f.email} onInput=${set('email')} error=${err.email} />
        <${Field} id="login-pw" icon="lock" type="password" autocomplete="current-password" placeholder="Пароль" value=${f.pw} onInput=${set('pw')} error=${err.pw} />
        <div style="text-align:right"><button class="link t-subhead" onClick=${() => go('forgot')}>Забыли пароль?</button></div>
      </div>
      <div class="auth__actions">${btn('login', 'Войти')}</div>
    </div>`,
    forgot: html`<div class=${stepCls} key="forgot">
      <div class="auth__head"><h1 class="t-large">Сброс пароля</h1><p>Пришлём ссылку, по которой можно задать новый пароль.</p></div>
      <div class=${'auth__fields' + (shake % 2 ? ' is-shake' : '')} key=${'f' + shake}>
        <${Field} id="forgot-email" icon="mail" type="email" autocomplete="email" inputmode="email" placeholder="Почта" value=${f.email} onInput=${set('email')} error=${err.email} />
      </div>
      <div class="auth__actions">${btn('forgot', 'Отправить ссылку')}</div>
    </div>`,
    newpass: html`<div class=${stepCls} key="newpass">
      <div class="auth__head"><h1 class="t-large">Новый пароль</h1><p>Придумайте пароль для входа в Грош.</p></div>
      <div class=${'auth__fields' + (shake % 2 ? ' is-shake' : '')} key=${'f' + shake}>
        <${Field} id="new-pw" icon="lock" type="password" autocomplete="new-password" placeholder="Новый пароль" value=${f.pw} onInput=${set('pw')} error=${err.pw} />
        ${!err.pw && html`<div class="strength">${[1, 2, 3, 4].map(i => html`<i class=${i <= score ? 'on' : ''} style=${'--c:' + (PW_LEVEL[score]?.[1] || 'transparent')}></i>`)}</div>`}
      </div>
      <div class="auth__actions">${btn('newpass', 'Сохранить пароль')}</div>
    </div>`,
    magic: html`<div class=${stepCls} key="magic">
      <div class="auth__hero" style="padding-top:40px"><div class="app-icon" style="background:var(--green)"><${Icon} n="mark_email_read" /></div><h1 class="t-title1">Проверьте почту</h1><p>Отправили ссылку для входа на ${f.email.trim()}. Откройте письмо на этом устройстве и нажмите «Войти» — пароль не нужен.</p></div>
      <div class="auth__actions">${!required && html`<button class="btn btn--filled" onClick=${close}>Понятно</button>`}<button class="btn btn--plain" disabled=${!!busy} onClick=${() => submit('magic')}>${busy === 'magic' ? html`<${Spinner} />` : 'Отправить ещё раз'}</button></div>
    </div>`,
    sent: html`<div class=${stepCls} key="sent">
      <div class="auth__hero" style="padding-top:40px"><div class="app-icon" style="background:var(--green)"><${Icon} n="mark_email_read" /></div><h1 class="t-title1">Проверьте почту</h1><p>Отправили ссылку на ${f.email.trim()}. Она действует один час.</p></div>
      <div class="auth__actions"><button class="btn btn--filled" onClick=${() => go('login', true)}>Вернуться ко входу</button></div>
    </div>`,
  };
  const backTo = { login: 'welcome', forgot: 'login', sent: 'login', magic: 'welcome' }[step];
  return html`<div class=${'auth' + (required ? ' auth--page' : '') + (closing ? ' is-closing' : '')} role=${required ? 'main' : 'dialog'} aria-modal=${required ? null : 'true'} aria-label="Вход в Грош">
    <div class="auth__inner">
      <div class="auth__top">
        ${backTo ? html`<button class="back" onClick=${() => go(backTo, true)}><${Icon} n="chevron_left" />Назад</button>` : html`<span></span>`}
        ${required ? html`<span></span>` : html`<button class="circle-btn" aria-label="Закрыть" onClick=${close}><${Icon} n="close" /></button>`}
      </div>
      ${steps[step]}
      ${!supabase && html`<p class="auth__note" style="margin-top:16px">Сервер не подключён — пока данные хранятся только на этом устройстве.</p>`}
    </div>
  </div>
  ${gsheet && html`<${GoogleSheet} onCredential=${withGoogle} onRedirect=${() => { setGsheet(false); social('Google'); }} onClose=${() => setGsheet(false)} />`}`;
}
