import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon, Spinner, Field } from '@grosh/ui-kit';
import { plural } from '../lib/dates.js';
import { buzz, store, ui } from '../state/store.js';
import { supabase, authMessage, passkeyMessage, passkeySupported } from '../lib/supabase.js';
import { redirectUrl } from '../config.js';
import { GoogleSheet } from '../sheets/GoogleSheet.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const pwScore = p => !p ? 0 : Math.min(4, (p.length >= 8) + (/\d/.test(p)) + (/[a-zа-я]/.test(p) && /[A-ZА-Я]/.test(p)) + (/[^\w\sа-яА-Я]/.test(p)) + (p.length >= 12 ? 1 : 0) - (p.length < 8 ? 1 : 0)) || 1;
export const PW_LEVEL = [null, ['Слабый', 'var(--red)'], ['Средний', 'var(--orange)'], ['Хороший', 'var(--yellow)'], ['Надёжный', 'var(--green)']];
export function Auth({ start = 'welcome', onClose }) {
  const s = store.s;
  const [step, setStep] = useState(start), [back, setBack] = useState(false), [closing, setClosing] = useState(false);
  const [f, setF] = useState({ name: s.profile.name || '', email: '', pw: '', migrate: true });
  const [err, setErr] = useState({}), [busy, setBusy] = useState(false), [shake, setShake] = useState(0);
  const [withPw, setWithPw] = useState(false); // вход по паролю вместо ссылки на почту
  const go = (to, isBack = false) => { buzz(4); setBack(isBack); setErr({}); setStep(to); };
  const close = () => { if (closing) return; setClosing(true); store.set(st => ({ meta: { ...st.meta, onboarded: true } })); setTimeout(onClose, 330); };
  const set = k => v => { setF(x => ({ ...x, [k]: v })); if (err[k]) setErr(e => ({ ...e, [k]: null })); };
  const score = pwScore(f.pw);
  const fail = e => { setErr(e); setShake(x => x + 1); buzz([10, 30, 10]); };
  const done = msg => { close(); ui.toast(msg); };
  const offline = () => { ui.toast('Сервер не подключён: добавьте ключи Supabase в .env', null, 'error'); return true; };
  const submit = async kind => {
    const e = {};
    if (kind === 'register' && !f.name.trim()) e.name = 'Введите имя';
    if (kind !== 'newpass' && !EMAIL_RE.test(f.email.trim())) e.email = f.email ? 'Похоже, в адресе опечатка' : 'Введите почту';
    if (kind !== 'forgot' && kind !== 'magic' && f.pw.length < 8) e.pw = f.pw ? 'Пароль короче 8 символов' : 'Введите пароль';
    if (Object.keys(e).length) return fail(e);
    if (!supabase) return offline();
    const email = f.email.trim();
    setBusy(kind);
    try {
      if (kind === 'register') {
        localStorage.setItem('grosh.migrate', f.migrate ? '1' : '0');
        const { data, error } = await supabase.auth.signUp({ email, password: f.pw, options: { data: { name: f.name.trim() }, emailRedirectTo: redirectUrl() } });
        if (error) throw error;
        store.set(st => ({ profile: { ...st.profile, name: f.name.trim() } }));
        if (!data.session) return go('confirm'); // включено подтверждение почты
        done('Аккаунт создан');
      } else if (kind === 'login') {
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
      fail(kind === 'newpass' || kind === 'register' && /пароль/i.test(msg) ? { pw: msg } : { email: msg });
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
  const socials = html`<div class="auth__or">или</div>${passkeyBtn}${google}`;
  const socialsSignup = html`<div class="auth__or">или</div>${google}`;
  const nTx = s.tx.filter(t => !t.deletedAt).length, nAch = Object.keys(s.meta.ach).length;
  const stepCls = 'auth__step' + (back ? ' is-back' : '');
  const steps = {
    welcome: html`<div class=${stepCls} key="welcome">
      <div class="auth__hero"><div class="app-icon"><${Icon} n="savings" /></div><h1 class="t-large">Грош</h1><p>Учёт трат в тенге с наградами, челленджами и итогами месяца.</p></div>
      <div class="group">
        <div class="cell cell--icon"><span class="sq" style="--c:var(--blue)"><${Icon} n="cloud_sync" /></span><span class="cell__main"><span>Синхронизация</span><span class="cell__sub" style="white-space:normal">Телефон, компьютер и браузер видят одни данные</span></span></div>
        <div class="cell cell--icon"><span class="sq" style="--c:var(--green)"><${Icon} n="lock" /></span><span class="cell__main"><span>Данные только ваши</span><span class="cell__sub" style="white-space:normal">Вход по ссылке на почту, через Google или по Face ID — без пароля</span></span></div>
        <div class="cell cell--icon"><span class="sq" style="--c:var(--orange)"><${Icon} n="emoji_events" /></span><span class="cell__main"><span>Ничего не потеряется</span><span class="cell__sub" style="white-space:normal">Записи и награды с устройства переедут в аккаунт</span></span></div>
      </div>
      <div class="auth__actions">
        <button class="btn btn--filled" onClick=${() => go('register')}>Создать аккаунт</button>
        <button class="btn btn--tinted" onClick=${() => go('login')}>Войти</button>
        <button class="btn btn--plain" onClick=${close}>Продолжить без аккаунта</button>
      </div>
    </div>`,
    login: html`<div class=${stepCls} key="login">
      <div class="auth__head"><h1 class="t-large">Вход</h1><p>С возвращением. Записи синхронизируются сразу после входа.</p></div>
      <div class=${'auth__fields' + (shake % 2 ? ' is-shake' : '')} key=${'f' + shake}>
        <${Field} id="login-email" icon="mail" type="email" autocomplete="email" inputmode="email" placeholder="Почта" value=${f.email} onInput=${set('email')} error=${err.email} />
        ${withPw && html`<${Field} id="login-pw" icon="lock" type="password" autocomplete="current-password" placeholder="Пароль" value=${f.pw} onInput=${set('pw')} error=${err.pw} />`}
        <div class="auth__links">
          <button class="link t-subhead" onClick=${() => { buzz(4); setErr({}); setWithPw(v => !v); }}>${withPw ? 'Войти по ссылке без пароля' : 'Войти с паролем'}</button>
          ${withPw && html`<button class="link t-subhead" onClick=${() => go('forgot')}>Забыли пароль?</button>`}
        </div>
      </div>
      <div class="auth__actions">${withPw ? btn('login', 'Войти') : btn('magic', 'Прислать ссылку для входа')}${socials}</div>
      <div class="auth__foot">Нет аккаунта? <button class="link" onClick=${() => go('register')}>Создать</button></div>
    </div>`,
    register: html`<div class=${stepCls} key="register">
      <div class="auth__head"><h1 class="t-large">Новый аккаунт</h1><p>Займёт полминуты.</p></div>
      <div class=${'auth__fields' + (shake % 2 ? ' is-shake' : '')} key=${'f' + shake}>
        <${Field} id="reg-name" icon="person" autocomplete="name" placeholder="Имя" value=${f.name} onInput=${set('name')} error=${err.name} />
        <${Field} id="reg-email" icon="mail" type="email" autocomplete="email" inputmode="email" placeholder="Почта" value=${f.email} onInput=${set('email')} error=${err.email} />
        <div>
          <${Field} id="reg-pw" icon="lock" type="password" autocomplete="new-password" placeholder="Пароль" value=${f.pw} onInput=${set('pw')} error=${err.pw} />
          ${!err.pw && html`<div class="strength">${[1, 2, 3, 4].map(i => html`<i class=${i <= score ? 'on' : ''} style=${'--c:' + (PW_LEVEL[score]?.[1] || 'transparent')}></i>`)}</div>
          <div class="helper">${f.pw ? `${PW_LEVEL[score][0]} пароль` : 'Минимум 8 символов, лучше с цифрами и заглавными'}</div>`}
        </div>
        <div class="group"><div class="cell" onClick=${() => set('migrate')(!f.migrate)} style="cursor:pointer">
          <span class="cell__main"><span>Перенести данные с устройства</span><span class="cell__sub">${nTx} ${plural(nTx, 'запись', 'записи', 'записей')} и ${nAch} ${plural(nAch, 'награда', 'награды', 'наград')}</span></span>
          <button class="check" role="checkbox" aria-checked=${String(f.migrate)} aria-label="Перенести данные"><${Icon} n="check" /></button>
        </div></div>
      </div>
      <div class="auth__actions">${btn('register', 'Создать аккаунт')}${socialsSignup}<div class="auth__note">Создавая аккаунт, вы соглашаетесь с <a href="privacy.html" target="_blank" rel="noopener" style="color:var(--tint)">политикой конфиденциальности</a>.</div></div>
      <div class="auth__foot">Уже есть аккаунт? <button class="link" onClick=${() => go('login')}>Войти</button></div>
    </div>`,
    forgot: html`<div class=${stepCls} key="forgot">
      <div class="auth__head"><h1 class="t-large">Сброс пароля</h1><p>Пришлём ссылку, по которой можно задать новый пароль.</p></div>
      <div class=${'auth__fields' + (shake % 2 ? ' is-shake' : '')} key=${'f' + shake}>
        <${Field} id="forgot-email" icon="mail" type="email" autocomplete="email" inputmode="email" placeholder="Почта" value=${f.email} onInput=${set('email')} error=${err.email} />
      </div>
      <div class="auth__actions">${btn('forgot', 'Отправить ссылку')}</div>
    </div>`,
    confirm: html`<div class=${stepCls} key="confirm">
      <div class="auth__hero" style="padding-top:40px"><div class="app-icon" style="background:var(--green)"><${Icon} n="mark_email_read" /></div><h1 class="t-title1">Подтвердите почту</h1><p>Отправили письмо на ${f.email.trim()}. Откройте его и нажмите ссылку — после этого вы сразу войдёте.</p></div>
      <div class="auth__actions"><button class="btn btn--filled" onClick=${close}>Понятно</button><button class="btn btn--plain" onClick=${() => go('login', true)}>Уже подтвердил — войти</button></div>
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
      <div class="auth__actions"><button class="btn btn--filled" onClick=${close}>Понятно</button><button class="btn btn--plain" disabled=${!!busy} onClick=${() => submit('magic')}>${busy === 'magic' ? html`<${Spinner} />` : 'Отправить ещё раз'}</button></div>
    </div>`,
    sent: html`<div class=${stepCls} key="sent">
      <div class="auth__hero" style="padding-top:40px"><div class="app-icon" style="background:var(--green)"><${Icon} n="mark_email_read" /></div><h1 class="t-title1">Проверьте почту</h1><p>Отправили ссылку на ${f.email.trim()}. Она действует один час.</p></div>
      <div class="auth__actions"><button class="btn btn--filled" onClick=${() => go('login', true)}>Вернуться ко входу</button></div>
    </div>`,
  };
  const backTo = { login: 'welcome', register: 'welcome', forgot: 'login', sent: 'login', magic: 'login', confirm: 'register' }[step];
  return html`<div class=${'auth' + (closing ? ' is-closing' : '')} role="dialog" aria-modal="true" aria-label="Вход в Грош">
    <div class="auth__inner">
      <div class="auth__top">
        ${backTo ? html`<button class="back" onClick=${() => go(backTo, true)}><${Icon} n="chevron_left" />Назад</button>` : html`<span></span>`}
        <button class="circle-btn" aria-label="Закрыть" onClick=${close}><${Icon} n="close" /></button>
      </div>
      ${steps[step]}
      ${!supabase && html`<p class="auth__note" style="margin-top:16px">Сервер не подключён — пока данные хранятся только на этом устройстве.</p>`}
    </div>
  </div>
  ${gsheet && html`<${GoogleSheet} onCredential=${withGoogle} onRedirect=${() => { setGsheet(false); social('Google'); }} onClose=${() => setGsheet(false)} />`}`;
}
