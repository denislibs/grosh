import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Icon, Passcode, Dialog } from '@grosh/ui-kit';
import { bio, bioMessage } from '../lib/biometric.js';
import { supabase } from '../lib/supabase.js';
import { lock } from '../state/lock.js';

const secs = ms => Math.ceil(ms / 1000);
const waitText = ms => (ms >= 60_000 ? `Попробуйте через ${Math.ceil(ms / 60_000)} мин` : `Попробуйте через ${secs(ms)} с`);

/** Экран блокировки: при запуске и после фона. onUnlock — ключ данных уже в памяти. */
export function Lock({ onUnlock }) {
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [wait, setWait] = useState(lock.waitLeft());
  const [closing, setClosing] = useState(false), [forgot, setForgot] = useState(false);
  const finish = () => { setClosing(true); setTimeout(onUnlock, 280); };

  // обратный отсчёт после серии неверных кодов
  useEffect(() => {
    if (!wait) return;
    const t = setInterval(() => { const w = lock.waitLeft(); setWait(w); if (!w) setErr(''); }, 1000);
    return () => clearInterval(t);
  }, [wait > 0]);

  const tryBio = async auto => {
    if (busy) return;
    setBusy(true);
    try { await lock.unlockBio(); finish(); }
    catch (e) { const m = bioMessage(e); if (m && !auto) setErr(m); }
    finally { setBusy(false); }
  };
  // Safari разрешает Face ID только по нажатию — тогда тихо ждём кнопку
  useEffect(() => { if (lock.bio && !wait) tryBio(true); }, []);

  const onPin = async pin => {
    setBusy(true);
    const ok = await lock.unlockPin(pin);
    setBusy(false);
    if (ok) { finish(); return true; }
    const w = lock.waitLeft(), left = 5 - lock.fails();
    setWait(w);
    setErr(w ? waitText(w) : left > 0 && left < 3 ? `Неверный код. Осталось попыток до паузы: ${left}` : 'Неверный код');
    return false;
  };

  const reset = async () => {
    await lock.wipe();
    if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    location.reload();
  };

  return html`<div class=${'lock' + (closing ? ' is-closing' : '')} role="dialog" aria-modal="true" aria-label="Грош заблокирован">
    <div class="lock__inner">
      <div class="lock__icon"><${Icon} n="lock" fill /></div>
      <${Passcode} title="Введите код-пароль" error=${wait ? waitText(wait) : err} disabled=${busy || wait > 0} onComplete=${onPin}
        left=${lock.bio && html`<button class="passcode__key passcode__key--plain" aria-label=${'Открыть ' + bio.by} onClick=${() => tryBio(false)}><${Icon} n=${bio.icon} /></button>`} />
      <button class="link t-subhead lock__forgot" onClick=${() => setForgot(true)}>Забыли код?</button>
    </div>
    ${forgot && html`<${Dialog} onClose=${() => setForgot(false)} d=${{
      title: 'Сбросить код-пароль?',
      msg: 'Данные на этом устройстве удалятся, и вы выйдете из аккаунта. После входа всё, что успело синхронизироваться, вернётся.',
      actions: [{ label: 'Отмена', style: 'bold' }, { label: 'Сбросить', style: 'destructive', run: reset }],
    }} />`}
  </div>`;
}
