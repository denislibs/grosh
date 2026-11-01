import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Icon, SheetNav, Spinner, Banner } from '@grosh/ui-kit';
import { dateLong } from '../lib/dates.js';
import { supabase, passkeyMessage, passkeySupported } from '../lib/supabase.js';
import { buzz, ui } from '../state/store.js';

const day = ts => (ts ? dateLong(String(ts).slice(0, 10)) : '');

/** Ключи доступа (passkeys): вход по Face ID / Touch ID / PIN-коду без пароля. */
export function PasskeySheet({ close }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const supported = passkeySupported();

  const load = async () => {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) { setError(passkeyMessage(error) || 'Не удалось загрузить ключи'); setList([]); return; }
    setError(null); setList(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    setBusy(true);
    const { error } = await supabase.auth.registerPasskey();
    setBusy(false);
    if (error) { const m = passkeyMessage(error); if (m) ui.toast(m, null, 'error'); return; }
    buzz(12); ui.toast('Ключ доступа добавлен');
    load();
  };
  const remove = pk => ui.dialog({
    title: 'Удалить ключ доступа?',
    msg: `«${pk.friendly_name || 'Ключ доступа'}» больше не будет открывать Грош. Войти можно будет по почте или через Google.`,
    actions: [{ label: 'Отмена', style: 'bold' }, { label: 'Удалить', style: 'destructive', run: async () => {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: pk.id });
      if (error) ui.toast(passkeyMessage(error) || 'Не удалось удалить ключ', null, 'error');
      else { ui.toast('Ключ удалён'); load(); }
    } }],
  });

  return html`<${SheetNav} title="Ключи доступа" onCancel=${close} cancel="Закрыть" />
    <div class="sheet__body">
      <div class="auth__hero" style="padding-top:4px">
        <div class="app-icon" style="width:72px;height:72px;border-radius:17px"><${Icon} n="passkey" /></div>
        <p>Входите в Грош по Face ID, Touch ID или PIN-коду устройства — без пароля. Ключ хранится в связке ключей iCloud или в Google и сам появляется на ваших устройствах.</p>
      </div>
      ${!supported && html`<${Banner} kind="warning" title="Браузер не поддерживает ключи доступа">Откройте Грош в Safari, Chrome или Edge последней версии.<//>`}
      ${error && html`<${Banner} kind="error" title="Ошибка">${error}<//>`}
      <div class="section"><div class="section__header">Ваши ключи</div><div class="group">
        ${list === null ? html`<div class="cell" style="justify-content:center"><${Spinner} /></div>`
          : list.length === 0 ? html`<div class="cell"><span class="cell__main secondary">Ключей пока нет</span></div>`
          : list.map(pk => html`<div class="cell cell--icon" key=${pk.id}>
              <span class="sq" style="--c:var(--blue)"><${Icon} n="passkey" /></span>
              <span class="cell__main"><span class="cell__title">${pk.friendly_name || 'Ключ доступа'}</span>
                <span class="cell__sub">Добавлен ${day(pk.created_at)}${pk.last_used_at ? ` · вход ${day(pk.last_used_at)}` : ''}</span></span>
              <button class="circle-btn" style="color:var(--red)" aria-label=${'Удалить ' + (pk.friendly_name || 'ключ')} onClick=${() => remove(pk)}><${Icon} n="delete" /></button>
            </div>`)}
      </div><div class="section__footer">Ключ работает на сайте denislibs.github.io/grosh. Удалённый ключ останется в связке ключей устройства, но войти им будет нельзя.</div></div>
      <button class="btn btn--filled" disabled=${!supported || busy} onClick=${add}>${busy ? html`<${Spinner} />` : html`<${Icon} n="add" />Добавить ключ доступа`}</button>
    </div>`;
}
