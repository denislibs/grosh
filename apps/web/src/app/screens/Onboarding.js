import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Icon, Field, Confetti } from '@grosh/ui-kit';
import { initials } from '../lib/dates.js';
import { COLORS } from '../lib/categories.js';
import { bio, bioMessage, bioSupported } from '../lib/biometric.js';
import { buzz, store, ui } from '../state/store.js';
import { lock, useLock } from '../state/lock.js';
import { PinFlow } from '../sheets/PinSheet.js';

// «Рассрочки» заполняются сами, «Другое» нужно всегда — их не прячем
const FIXED = ['loan', 'other'];
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Первый вход в новый аккаунт: имя, финансовый месяц, категории, защита. */
export function Onboarding({ s, onDone }) {
  const lk = useLock();
  const [step, setStep] = useState(0), [back, setBack] = useState(false), [closing, setClosing] = useState(false);
  const [name, setName] = useState(s.profile.name || ''), [color, setColor] = useState(s.profile.color || 'blue');
  const [pay, setPay] = useState(s.settings.monthStart > 1 ? 'day' : null), [day, setDay] = useState(s.settings.monthStart > 1 ? s.settings.monthStart : 10);
  const pickable = s.categories.filter(c => c.type === 'expense' && !FIXED.includes(c.id));
  const [cats, setCats] = useState(() => new Set(pickable.filter(c => !c.archived).map(c => c.id)));
  const [pinStep, setPinStep] = useState(lock.on ? 'done' : 'intro'); // intro | flow | done
  const [bioOk, setBioOk] = useState(false), [bioBusy, setBioBusy] = useState(false);
  useEffect(() => { bioSupported().then(setBioOk); }, []);

  const go = (to, isBack = false) => { buzz(4); setBack(isBack); setStep(to); };
  const toggleCat = id => { buzz(4); setCats(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n.size ? n : c; }); };
  const enableBio = async () => {
    setBioBusy(true);
    try { await lock.enableBio(); buzz(12); } catch (e) { const m = bioMessage(e); if (m) ui.toast(m, null, 'error'); }
    setBioBusy(false);
  };
  const finish = () => {
    store.set(st => ({
      profile: { ...st.profile, name: name.trim(), color },
      settings: { ...st.settings, monthStart: pay === 'day' ? day : 1 },
      categories: st.categories.map(c => (pickable.some(p => p.id === c.id) ? { ...c, archived: !cats.has(c.id) } : c)),
      meta: { ...st.meta, setupDone: true, onboarded: true },
    }));
    setClosing(true); setTimeout(onDone, 330);
  };

  const cls = 'auth__step' + (back ? ' is-back' : '');
  const next = (label = 'Дальше', disabled = false, run = () => go(step + 1)) => html`<button class="btn btn--filled" disabled=${disabled} onClick=${run}>${label}</button>`;
  const period = day === 1 ? 'с 1-го до конца месяца' : `с ${day}-го по ${day - 1}-е`;

  const steps = [
    html`<div class=${cls} key="name">
      <div class="auth__head"><h1 class="t-large">Как вас зовут?</h1><p>Имя видно только вам — в профиле и в «Итогах месяца».</p></div>
      <div class="onb__avatar"><span class="avatar avatar--xl" style=${`--c:var(--${color})`}>${initials(name) || html`<${Icon} n="person" fill />`}</span></div>
      <div class="auth__fields">
        <form onSubmit=${e => { e.preventDefault(); name.trim() && go(1); }}>
          <${Field} id="onb-name" icon="person" autocomplete="given-name" placeholder="Имя" value=${name} onInput=${setName} />
        </form>
        <div class="group colors">${COLORS.map(c => html`<button class="color" style=${`--c:var(--${c})`} aria-pressed=${String(c === color)} aria-label=${'Цвет ' + c} onClick=${() => { buzz(5); setColor(c); }}></button>`)}</div>
      </div>
      <div class="auth__actions">${next('Дальше', !name.trim())}</div>
    </div>`,

    html`<div class=${cls} key="pay">
      <div class="auth__head"><h1 class="t-large">Когда приходит зарплата?</h1><p>От этого зависит ваш финансовый месяц в статистике и «Итогах месяца».</p></div>
      <div class="group">
        ${[['day', 'В определённый день', 'Месяц считается от зарплаты до зарплаты'], ['any', 'Когда как', 'Фриланс, аванс или разные дни — месяц будет календарным']].map(([id, title, sub]) => html`
          <button class="cell" role="radio" aria-checked=${String(pay === id)} onClick=${() => { buzz(4); setPay(id); }}>
            <span class="cell__main"><span>${title}</span><span class="cell__sub" style="white-space:normal">${sub}</span></span>
            ${pay === id && html`<${Icon} n="check" cls="onb__tick" />`}
          </button>`)}
      </div>
      ${pay === 'day' && html`<div class="section"><div class="section__header">Какого числа</div>
        <div class="day-grid" role="radiogroup" aria-label="День зарплаты">${DAYS.map(d => html`<button role="radio" aria-checked=${String(d === day)} onClick=${() => { buzz(4); setDay(d); }}>${d}</button>`)}</div>
        <div class="section__footer">Месяц: ${period}. Если зарплата 29–31-го, выберите 28.</div></div>`}
      <div class="auth__actions">${next('Дальше', !pay)}</div>
    </div>`,

    html`<div class=${cls} key="cats">
      <div class="auth__head"><h1 class="t-large">На что вы тратите?</h1><p>Оставьте нужные категории — остальные спрячем. Свои можно добавить потом в настройках.</p></div>
      <div class="cat-chips">${pickable.map(c => html`<button class="cat-chip" aria-pressed=${String(cats.has(c.id))} onClick=${() => toggleCat(c.id)}>
        <span class="sq" style=${`--c:var(--${c.color})`}><${Icon} n=${c.icon} /></span>${c.name}</button>`)}</div>
      <div class="auth__actions">${next(`Дальше · ${cats.size}`)}</div>
    </div>`,

    html`<div class=${cls} key="lock">
      ${pinStep === 'flow' ? html`<div class="onb__pin"><${PinFlow} mode="set" offer=${false} onDone=${() => setPinStep('done')} /></div>
        <div class="auth__actions"><button class="btn btn--plain" onClick=${() => setPinStep('intro')}>Отмена</button></div>`
      : html`
      <div class="auth__head"><h1 class="t-large">Защитите записи</h1><p>Чтобы никто, кроме вас, не открыл Грош на этом устройстве.</p></div>
      <div class="group">
        <div class="cell cell--icon"><span class="sq" style=${'--c:var(--' + (lk.on ? 'green' : 'gray') + ')'}><${Icon} n=${lk.on ? 'check' : 'lock'} /></span><span class="cell__main"><span>Код-пароль</span><span class="cell__sub" style="white-space:normal">${lk.on ? 'Включён — записи на устройстве зашифрованы' : '6 цифр. Записи на устройстве будут зашифрованы'}</span></span></div>
        ${bioOk && html`<div class="cell cell--icon"><span class="sq" style=${'--c:var(--' + (lk.bio ? 'green' : 'gray') + ')'}><${Icon} n=${lk.bio ? 'check' : bio.icon} /></span><span class="cell__main"><span>${bio.name}</span><span class="cell__sub" style="white-space:normal">${lk.bio ? `Грош открывается ${bio.by}` : `Открывать ${bio.by}, не вводя код`}</span></span></div>`}
      </div>
      <div class="auth__actions">
        ${!lk.on ? html`${next('Включить код-пароль', false, () => { buzz(6); setPinStep('flow'); })}<button class="btn btn--plain" onClick=${() => go(4)}>Не сейчас</button>`
          : bioOk && !lk.bio ? html`<button class="btn btn--filled" disabled=${bioBusy} onClick=${enableBio}><${Icon} n=${bio.icon} />Включить ${bio.name}</button><button class="btn btn--plain" onClick=${() => go(4)}>Не сейчас</button>`
          : next()}
      </div>`}
    </div>`,

    html`<div class=${cls} key="done">
      <${Confetti} />
      <div class="auth__hero" style="padding-top:48px"><span class="avatar avatar--xl" style=${`--c:var(--${color})`}>${initials(name) || html`<${Icon} n="person" fill />`}</span>
        <h1 class="t-title1">Всё готово, ${name.trim()}!</h1><p>Добавьте первую трату — кнопка «+» внизу. За неё положена первая награда.</p></div>
      <div class="auth__actions">${next('Начать', false, finish)}</div>
    </div>`,
  ];

  return html`<div class=${'auth onb' + (closing ? ' is-closing' : '')} role="dialog" aria-modal="true" aria-label="Настройка Гроша">
    <div class="auth__inner">
      <div class="auth__top">
        ${step > 0 && step < 4 && pinStep !== 'flow' ? html`<button class="back" onClick=${() => go(step - 1, true)}><${Icon} n="chevron_left" />Назад</button>` : html`<span></span>`}
        ${step < 4 && html`<div class="onb__dots" aria-label=${`Шаг ${step + 1} из 4`}>${[0, 1, 2, 3].map(i => html`<i class=${i <= step ? 'is-on' : ''}></i>`)}</div>`}
        ${step > 0 && step < 3 ? html`<button class="btn btn--plain onb__skip" onClick=${() => go(step + 1)}>Пропустить</button>` : html`<span></span>`}
      </div>
      ${steps[step]}
    </div>
  </div>`;
}
