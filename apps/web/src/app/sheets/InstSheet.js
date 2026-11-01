import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon, Seg, SheetNav, DatePicker } from '@grosh/ui-kit';
import { TODAY, dateLong, fmt, money, parse, plural, uid } from '../lib/dates.js';
import { digitsOnly, instState, numOf } from '../lib/finance.js';
import { mutate, store, ui } from '../state/store.js';

export function InstSheet({ it, close }) {
  const isNew = !it;
  const [name, setName] = useState(it?.name || '');
  const [total, setTotal] = useState(it ? fmt(it.total) : '');
  const [months, setMonths] = useState(it?.months || 12);
  const [first, setFirst] = useState(it?.first || TODAY);
  const [pb, setPb] = useState(it?.paidBefore || 0);
  const tot = numOf(total);
  const st = it ? instState(it, store.s.tx.filter(t => !t.deletedAt)) : null;
  const save = () => {
    if (!name.trim()) return ui.toast('Введите название покупки', null, 'error');
    if (tot < 1000) return ui.toast('Сумма от 1 000 ₸', null, 'error');
    close();
    const data = { name: name.trim(), total: tot, months, first, paidBefore: Math.min(pb, months) };
    mutate(s0 => { const list = isNew ? [...(s0.installments || []), { id: uid(), createdAt: Date.now(), ...data }] : s0.installments.map(x => (x.id === it.id ? { ...x, ...data } : x)); return { installments: list, tx: [...s0.tx, ...instDue({ ...s0, installments: list })] }; });
    ui.toast(isNew ? `Рассрочка: ${money(Math.round(tot / months))} в месяц` : 'Рассрочка сохранена');
  };
  const del = () => ui.dialog({ title: 'Удалить рассрочку?', msg: 'Уже списанные платежи останутся в расходах.', actions: [{ label: 'Отмена', style: 'bold' }, { label: 'Удалить', style: 'destructive', run: () => { close(); store.set(s0 => ({ installments: s0.installments.filter(x => x.id !== it.id) })); ui.toast('Рассрочка удалена'); } }] });
  return html`<${SheetNav} title=${isNew ? 'Новая рассрочка' : it.name} onCancel=${close} done=${isNew ? 'Добавить' : 'Готово'} onDone=${save} />
    <div class="sheet__body">
      ${st && html`<div class="card" style="justify-items:center;text-align:center">
        <div class="metric__label">${st.done ? 'Рассрочка выплачена' : 'Осталось выплатить'}</div>
        <div class="metric__v">${fmt(st.left)}<small>₸</small></div>
        <div class="progress" style=${`width:100%;--p:${st.paidN / it.months};--c:var(--purple)`}><i></i></div>
        <div class="metric__sub">${st.paidN} из ${it.months} платежей${st.next ? ` · следующий ${dateLong(st.next.date)}` : ''}</div>
      </div>`}
      <div class="section"><div class="section__header">Покупка</div><div class="group">
        <label class="cell" for="inst-name"><span>Название</span><input class="cell__input" id="inst-name" placeholder="iPhone 16" value=${name} onInput=${e => setName(e.target.value)} /></label>
        <label class="cell" for="inst-total"><span>Сумма</span><input class="cell__input num" id="inst-total" inputmode="numeric" placeholder="0 ₸" value=${total} onInput=${e => setTotal(digitsOnly(e.target.value))} /></label>
        <div class="cell"><span class="cell__main">Срок, мес.</span><${Seg} items=${[[3, '3'], [6, '6'], [12, '12'], [24, '24']]} value=${months} onChange=${v => { setMonths(v); setPb(x => Math.min(x, v - 1)); }} style="width:180px" /></div>
        <div class="cell"><span class="cell__main">Первый платёж</span><${DatePicker} id="inst-first" label="Первый платёж" value=${first} onChange=${setFirst} weekStart=${store.s.settings.weekStart} format=${d => dateLong(d) + " " + parse(d).getFullYear()} /></div>
        <div class="cell"><span class="cell__main">Оплачено до учёта</span><div class="stepper"><button aria-label="Меньше" disabled=${pb <= 0} onClick=${() => setPb(x => Math.max(0, x - 1))}><${Icon} n="remove" /></button><b>${pb}</b><button aria-label="Больше" disabled=${pb >= months - 1} onClick=${() => setPb(x => Math.min(months - 1, x + 1))}><${Icon} n="add" /></button></div></div>
      </div><div class="section__footer">${tot ? `${money(Math.round(tot / months))} в месяц, ${months} ${plural(months, 'платёж', 'платежа', 'платежей')}. ` : ''}Платёж списывается сам в день оплаты. Если часть уже была оплачена до начала учёта, укажите сколько.</div></div>
      ${st && html`<div class="section"><div class="section__header">График платежей</div><div class="group">
        ${st.sch.map(pp => { const paid = st.paid.has(pp.k), soon = !paid && pp === st.next; return html`<div class="cell">
          <${Icon} n=${paid ? 'check_circle' : 'radio_button_unchecked'} fill=${paid} style=${'color:' + (paid ? 'var(--green)' : soon ? 'var(--orange)' : 'var(--label-3)')} />
          <span class="cell__main" style=${paid ? 'color:var(--label-2)' : ''}>${dateLong(pp.date)} ${parse(pp.date).getFullYear()}</span>
          <span class="cell__value">${fmt(pp.amount)} ₸</span></div>`; })}
      </div></div>`}
      ${!isNew && html`<div class="group"><button class="cell cell--destructive" onClick=${del}>Удалить рассрочку</button></div>`}
    </div>`;
}
