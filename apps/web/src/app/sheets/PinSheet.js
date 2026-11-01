import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Passcode, SheetNav } from '@grosh/ui-kit';
import { weakPin } from '../lib/vault.js';
import { bio, bioMessage, bioSupported } from '../lib/biometric.js';
import { buzz, ui } from '../state/store.js';
import { lock } from '../state/lock.js';

const TITLES = { old: 'Введите текущий код', new: 'Придумайте код из 6 цифр', repeat: 'Повторите код' };

/**
 * Включить, сменить или выключить код-пароль. mode: 'set' | 'change' | 'off'.
 * onDone — всё сделано; offer — после включения предложить Face ID диалогом.
 */
export function PinFlow({ mode, onDone, offer = true }) {
  const [step, setStep] = useState(mode === 'set' ? 'new' : 'old');
  const [first, setFirst] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const offerBio = async () => {
    if (lock.bio || !(await bioSupported())) return;
    ui.dialog({
      title: `Открывать ${bio.by}?`, msg: 'Не придётся вводить код каждый раз. Код-пароль останется на случай, если биометрия не сработает.',
      actions: [{ label: 'Не сейчас' }, { label: 'Включить', style: 'bold', run: async () => {
        try { await lock.enableBio(); buzz(12); ui.toast(`Грош открывается ${bio.by}`); }
        catch (e) { const m = bioMessage(e); if (m) ui.toast(m, null, 'error'); }
      } }],
    });
  };

  const onCode = async code => {
    setErr('');
    if (step === 'old') {
      if (lock.waitLeft()) { setErr('Слишком много попыток. Подождите немного.'); return false; }
      setBusy(true); const ok = await lock.unlockPin(code); setBusy(false);
      if (!ok) { setErr('Неверный код'); return false; }
      if (mode === 'off') {
        setBusy(true); await lock.disable(); setBusy(false);
        onDone(); ui.toast('Код-пароль выключен'); return;
      }
      setStep('new'); return;
    }
    if (step === 'new') {
      if (weakPin(code)) { setErr('Слишком простой код. Выберите другой.'); return false; }
      setFirst(code); setStep('repeat'); return;
    }
    if (code !== first) { setStep('new'); setFirst(''); setErr('Коды не совпали. Попробуйте ещё раз.'); return false; }
    setBusy(true);
    if (mode === 'set') await lock.enable(code); else await lock.changePin(code);
    setBusy(false); buzz(12); onDone();
    if (mode === 'set') { ui.toast('Код-пароль включён'); if (offer) setTimeout(offerBio, 450); }
    else ui.toast('Код-пароль изменён');
  };

  const sub = busy ? 'Секунду…' : step === 'new' && mode === 'set' ? 'Код понадобится, чтобы открыть Грош на этом устройстве' : '';
  return html`<${Passcode} key=${step} title=${TITLES[step]} sub=${sub} error=${err} disabled=${busy} onComplete=${onCode} />`;
}

export function PinSheet({ mode, close }) {
  const title = mode === 'off' ? 'Выключить код-пароль' : mode === 'change' ? 'Сменить код-пароль' : 'Код-пароль';
  return html`<${SheetNav} title=${title} onCancel=${close} />
    <div class="sheet__body pin-sheet"><${PinFlow} mode=${mode} onDone=${close} /></div>`;
}
