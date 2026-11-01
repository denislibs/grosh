import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { useLabels } from '../config.js';
import { Icon } from './primitives.js';

/**
 * Текстовое поле: иконка слева, крестик очистки или глаз для пароля справа, ошибка под полем.
 */
export function Field({ id, icon, type = 'text', value, onInput, placeholder, error, autocomplete, inputmode, suffix, disabled }) {
  const t = useLabels();
  const [show, setShow] = useState(false);
  const pw = type === 'password';
  return html`<div>
    <label class=${'input' + (value ? ' has-value' : '') + (error ? ' is-error' : '') + (disabled ? ' is-disabled' : '')} for=${id}>
      ${icon && html`<${Icon} n=${icon} />`}
      <input id=${id} type=${pw && show ? 'text' : type} value=${value} placeholder=${placeholder} autocomplete=${autocomplete} inputmode=${inputmode}
        disabled=${disabled} onInput=${e => onInput(e.target.value)} aria-invalid=${error ? 'true' : 'false'} />
      ${suffix && html`<span class="input__suffix">${suffix}</span>`}
      ${pw ? html`<button type="button" class="pw-toggle" aria-label=${show ? t.hidePassword : t.showPassword} onClick=${() => setShow(!show)}><${Icon} n=${show ? 'visibility_off' : 'visibility'} /></button>`
        : !suffix && html`<button type="button" class="input__clear" aria-label=${t.clear} onClick=${() => onInput('')}><${Icon} n="close" /></button>`}
    </label>
    ${error && html`<div class="helper helper--error">${error}</div>`}
  </div>`;
}

/** Поиск с выезжающей «Отменой». */
export function SearchField({ id, value, onInput, placeholder }) {
  const t = useLabels();
  const [focus, setFocus] = useState(false);
  const keep = e => e.preventDefault();
  return html`<div class=${'search' + (focus || value ? ' is-active' : '')}>
    <label class=${'search__field' + (value ? ' has-value' : '')} for=${id}><${Icon} n="search" />
      <input id=${id} type="search" placeholder=${placeholder || t.search} value=${value} onInput=${e => onInput(e.target.value)} onFocus=${() => setFocus(true)} onBlur=${() => setFocus(false)} />
      <button type="button" class="input__clear" aria-label=${t.clear} onMouseDown=${keep} onClick=${() => onInput('')}><${Icon} n="close" /></button>
    </label>
    <button class="search__cancel" onMouseDown=${keep} onClick=${() => { onInput(''); setFocus(false); document.activeElement?.blur(); }}>${t.cancel}</button>
  </div>`;
}
