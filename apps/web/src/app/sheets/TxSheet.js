import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { Icon, Sq, SheetNav, DatePicker, Menu } from '@grosh/ui-kit';
import { TODAY, YESTERDAY, dateLong, fmt, money } from '../lib/dates.js';
import { addTx, buzz, catOf, delTx, store, ui, updTx } from '../state/store.js';

export const evalExpr = s => s.split(/(?=[+−])/).reduce((a, t) => a + (t[0] === '−' ? -1 : 1) * (+t.replace(/[+−]/, '') || 0), 0);
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'];
const dayText = d => (d === TODAY ? 'Сегодня' : d === YESTERDAY ? 'Вчера' : dateLong(d));

/**
 * Новая запись или правка — как перевод в Apple Cash: крупная сумма, под ней заметка, категория и дата,
 * внизу цифры и одна кнопка. Калькулятор (+ и −) — по долгому нажатию на сумму или с клавиатуры компьютера.
 */
export function TxSheet({ tx, preset, close }) {
  const s = store.s;
  const [type, setType] = useState(tx?.type || preset?.type || 'expense');
  const [expr, setExpr] = useState(tx ? String(tx.amount) : '');
  const [cat, setCat] = useState(tx?.cat || null);
  const [date, setDate] = useState(tx?.date || preset?.date || TODAY);
  const [note, setNote] = useState(tx?.note || '');
  const [shake, setShake] = useState(0);
  const [panel, setPanel] = useState('keys'); // keys | cats
  const [calc, setCalc] = useState(false);
  const pending = useRef(false); // нажали «Добавить» без категории — сохраним, как только её выберут
  const cats = s.categories.filter(c => c.type === type && !c.archived).sort((a, b) => a.order - b.order);
  // последние использованные категории — первыми
  const recent = useMemo(() => { const m = {}; s.tx.filter(t => !t.deletedAt && t.type === type).slice(-60).forEach((t, i) => (m[t.cat] = i)); return m; }, [type]);
  const sorted = [...cats].sort((a, b) => (recent[b.id] ?? -1) - (recent[a.id] ?? -1));
  const amount = Math.max(0, evalExpr(expr));
  const hasOp = /[+−]/.test(expr);
  const c = cat && catOf(cat);
  useEffect(() => { if (cat && !cats.some(x => x.id === cat)) setCat(null); }, [type]);

  const press = k => {
    buzz(4);
    setExpr(e => {
      if (k === 'C') return '';
      if (k === '⌫') return e.slice(0, -1);
      if (k === '+' || k === '−') return !e || '+−'.includes(e.at(-1)) ? e : e + k;
      if (e.length >= 14) return e;
      if ((e === '' || '+−'.includes(e.at(-1))) && (k === '0' || k === '000')) return e;
      return e + k;
    });
  };
  const fail = msg => { setShake(x => x + 1); buzz([10, 30, 10]); if (msg) ui.toast(msg, null, 'error'); };
  const save = (category = cat) => {
    if (!amount) return fail();
    if (!category) { pending.current = true; buzz(6); return setPanel('cats'); }
    const data = { type, amount: Math.round(amount), cat: category, date, note: note.trim() };
    if (hasOp) store.set(st => ({ meta: { ...st.meta, calcUsed: true } }));
    close();
    setTimeout(() => {
      if (tx) { updTx(tx.id, data); ui.toast('Изменения сохранены'); }
      else { addTx(data); ui.toast(`${catOf(category).name}: ${type === 'income' ? '+' : '−'}${money(data.amount)}`); }
      buzz(12);
    }, 220);
  };
  const pick = id => {
    buzz(6); setCat(id); setPanel('keys');
    if (pending.current) { pending.current = false; save(id); }
  };

  // долгое нажатие на сумму включает калькулятор; долгое на «стереть» — очищает (и тогда обычное нажатие не срабатывает)
  const holdAmt = useRef(0), holdDel = useRef(0);
  const holdOn = (ref, fn) => ({ onPointerDown: () => { ref.current = setTimeout(() => { ref.current = -1; buzz(10); fn(); }, 450); }, onPointerUp: () => clearTimeout(ref.current), onPointerLeave: () => clearTimeout(ref.current) });

  // с клавиатуры компьютера: цифры, Backspace, + и −, Enter
  useEffect(() => {
    const k = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === '+' || e.key === '-') { setCalc(true); press(e.key === '+' ? '+' : '−'); }
      else if (e.key === 'Enter') save();
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const accent = type === 'income' ? 'var(--green)' : 'var(--tint)';
  const typeMenu = html`<${Menu} label="Тип записи" triggerClass="capsule capsule--glass tx-type" align="center"
    items=${[{ label: 'Расход', checked: type === 'expense', onSelect: () => setType('expense') }, { label: 'Доход', checked: type === 'income', onSelect: () => setType('income') }]}>
    ${tx ? 'Запись' : type === 'income' ? 'Доход' : 'Расход'}<${Icon} n="expand_more" /><//>`;

  return html`
    <${SheetNav} glass title=${typeMenu} onCancel=${close} />
    <div class="sheet__body">
      <div class=${'tx' + (type === 'income' ? ' tx--income' : '')} style=${`--accent:${accent}`}>
        <div class="tx__top">
          <div class=${'amount' + (shake % 2 ? ' is-shake' : '')} key=${'sh' + shake} ...${holdOn(holdAmt, () => setCalc(true))}>
            <div class="amount__expr">${hasOp ? expr.split(/([+−])/).map(x => (/\d/.test(x) ? fmt(+x) : ` ${x} `)).join('') + ' =' : ''}</div>
            <div class=${'amount__val' + (amount ? '' : ' is-empty')}>${type === 'income' && amount ? '+' : ''}${fmt(amount)}<span class="cur">₸</span></div>
          </div>
          <input class="tx__note" id="tx-note" placeholder="Добавить заметку" value=${note} onInput=${e => setNote(e.target.value)} maxlength="80" />
          <div class="tx__chips">
            <button class=${'capsule capsule--glass tx__cat' + (c ? '' : ' is-empty')} aria-pressed=${String(panel === 'cats')} onClick=${() => { buzz(4); pending.current = false; setPanel(p => (p === 'cats' ? 'keys' : 'cats')); }}>
              ${c ? html`<span class="tx__dot" style=${`--c:var(--${c.color})`}><${Icon} n=${c.icon} fill /></span>${c.name}` : html`<${Icon} n="category" />Категория`}
            </button>
            <${DatePicker} id="tx-date" label="Дата" value=${date} pressed=${false} max=${TODAY} weekStart=${s.settings.weekStart} format=${dayText} onChange=${setDate} />
          </div>
          ${tx && html`<button class="link t-subhead tx__del" onClick=${() => { close(); setTimeout(() => delTx(tx), 220); }}>Удалить запись</button>`}
        </div>

        <div class="tx__bottom">
          ${panel === 'cats' ? html`<div class="tx-cats" role="listbox" aria-label="Категория">
            ${sorted.map(x => html`<button class="tx-cats__item" role="option" aria-selected=${String(x.id === cat)} onClick=${() => pick(x.id)}><${Sq} c=${x} size="md" /><span>${x.name}</span></button>`)}
          </div>` : html`
            ${calc && html`<div class="cashpad__ops">
              <button onClick=${() => press('+')} aria-label="Плюс">+</button><button onClick=${() => press('−')} aria-label="Минус">−</button><button onClick=${() => { setCalc(false); setExpr(String(Math.round(amount) || '')); }} aria-label="Посчитать">=</button>
            </div>`}
            <div class="cashpad">
              ${DIGITS.map(k => html`<button class="cashpad__key" aria-label=${k === '⌫' ? 'Стереть (удерживайте, чтобы очистить)' : k}
                onClick=${() => { if (k === '⌫' && holdDel.current === -1) { holdDel.current = 0; return; } press(k); }} ...${k === '⌫' ? holdOn(holdDel, () => setExpr('')) : {}}>
                ${k === '⌫' ? html`<${Icon} n="backspace" />` : k}</button>`)}
            </div>`}
          <button class="btn btn--filled btn--capsule tx__save" onClick=${() => save()}>${tx ? 'Сохранить' : 'Добавить'}</button>
        </div>
      </div>
    </div>`;
}
