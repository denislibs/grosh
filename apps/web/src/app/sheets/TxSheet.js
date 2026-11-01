import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { Icon, Sq, Seg, SheetNav, DatePicker } from '@grosh/ui-kit';
import { TODAY, YESTERDAY, cap, dateLong, fmt, money } from '../lib/dates.js';
import { addTx, buzz, catOf, delTx, store, ui, updTx } from '../state/store.js';

export const evalExpr = s => s.split(/(?=[+−])/).reduce((a, t) => a + (t[0] === '−' ? -1 : 1) * (+t.replace(/[+−]/, '') || 0), 0);
export function TxSheet({ tx, preset, close }) {
  const s = store.s;
  const [type, setType] = useState(tx?.type || preset?.type || 'expense');
  const [expr, setExpr] = useState(tx ? String(tx.amount) : '');
  const [cat, setCat] = useState(tx?.cat || null);
  const [date, setDate] = useState(tx?.date || preset?.date || TODAY);
  const [note, setNote] = useState(tx?.note || '');
  const [shake, setShake] = useState(0);
  const cats = s.categories.filter(c => c.type === type && !c.archived).sort((a, b) => a.order - b.order);
  // последние использованные категории — первыми
  const recent = useMemo(() => { const m = {}; s.tx.filter(t => !t.deletedAt && t.type === type).slice(-60).forEach((t, i) => (m[t.cat] = i)); return m; }, [type]);
  const sorted = [...cats].sort((a, b) => (recent[b.id] ?? -1) - (recent[a.id] ?? -1));
  const amount = Math.max(0, evalExpr(expr));
  const hasOp = /[+−]/.test(expr);
  useEffect(() => { if (cat && !cats.some(c => c.id === cat)) setCat(null); }, [type]);

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
  const fail = msg => { setShake(x => x + 1); buzz([10, 30, 10]); ui.toast(msg, null, 'error'); };
  const save = () => {
    if (!amount) return fail('Введите сумму');
    if (!cat) return fail('Выберите категорию');
    const data = { type, amount: Math.round(amount), cat, date, note: note.trim() };
    if (hasOp) store.set(st => ({ meta: { ...st.meta, calcUsed: true } }));
    close();
    setTimeout(() => {
      if (tx) { updTx(tx.id, data); ui.toast('Изменения сохранены'); }
      else { addTx(data); ui.toast(`${catOf(cat).name}: ${type === 'income' ? '+' : '−'}${money(data.amount)}`); }
      buzz(12);
    }, 220);
  };
  const keys = ['1', '2', '3', '⌫', '4', '5', '6', '+', '7', '8', '9', '−', '000', '0', 'C'];
  const digits = fmt(amount).split('');
  return html`
    <${SheetNav} title=${tx ? 'Запись' : type === 'income' ? 'Новый доход' : 'Новый расход'} onCancel=${close} done=${tx ? 'Готово' : 'Добавить'} onDone=${save} />
    <div class="sheet__body">
      <div class=${'tx' + (type === 'income' ? ' tx--income' : '')}>
        <${Seg} items=${[['expense', 'Расход'], ['income', 'Доход']]} value=${type} onChange=${setType} />
        <div class=${'amount' + (shake % 2 ? ' is-shake' : '')} key=${'sh' + shake}>
          <div class="amount__expr">${hasOp ? expr.replace(/([+−])/g, ' $1 ') + ' =' : ''}</div>
          <div class="amount__val">${type === 'income' ? '+' : ''}${digits.join('')}<span class="cur">₸</span></div>
        </div>
        <div class="picks">
          ${sorted.slice(0, 8).map(c => html`<button class="pick" style=${`--c:var(--${c.color})`} aria-pressed=${String(c.id === cat)} onClick=${() => { buzz(6); setCat(c.id); }}><${Sq} c=${c} size="md" /><span>${c.name}</span></button>`)}
        </div>
        <div class="row-scroll">
          ${sorted.slice(8).map(c => html`<button class="capsule" aria-pressed=${String(c.id === cat)} onClick=${() => setCat(c.id)}><${Icon} n=${c.icon} fill />${c.name}</button>`)}
        </div>
        <div class="row-scroll">
          <button class="capsule" aria-pressed=${String(date === TODAY)} onClick=${() => setDate(TODAY)}>Сегодня</button>
          <button class="capsule" aria-pressed=${String(date === YESTERDAY)} onClick=${() => setDate(YESTERDAY)}>Вчера</button>
          <${DatePicker} id="tx-date" label="Дата" value=${date !== TODAY && date !== YESTERDAY ? date : null} placeholder="Дата" max=${TODAY} weekStart=${s.settings.weekStart} format=${dateLong} onChange=${setDate} />
        </div>
        <input class="field" id="tx-note" placeholder="Заметка" value=${note} onInput=${e => setNote(e.target.value)} />
        ${tx && html`<button class="btn btn--destructive" onClick=${() => { close(); setTimeout(() => delTx(tx), 220); }}>Удалить запись</button>`}
        <div class="pad" style=${`--accent:var(--${type === 'income' ? 'green' : 'tint'})`}>
          ${keys.map(k => html`<button class=${'key' + ('⌫+−'.includes(k) ? ' key--op' : '')} onClick=${() => press(k)} aria-label=${k === '⌫' ? 'Стереть' : k}>${k === '⌫' ? html`<${Icon} n="backspace" />` : k}</button>`)}
          <button class="key key--ok" style="grid-column:4;grid-row:4" onClick=${save} aria-label="Сохранить"><${Icon} n="check" /></button>
        </div>
      </div>
    </div>`;
}
