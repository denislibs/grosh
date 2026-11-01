import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { Icon, Seg, Switch, SheetNav } from '@grosh/ui-kit';
import { TODAY, cap, dateLong, diffDays, fmt, money, parse, uid } from '../lib/dates.js';
import { addMonths, depState, digitsOnly, effFromNom, fmtRate, mkTransfer, numOf, parseRate, syncRate } from '../lib/finance.js';
import { buzz, mutate, store, ui } from '../state/store.js';

export function DepSheet({ d, close }) {
  const s = store.s, isNew = !d;
  const [name, setName] = useState(d?.name || 'Накопительный');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState(d?.term || 12);
  const [cap, setCap] = useState(d?.cap ?? true);
  const [rf, setRf] = useState(() => { const n = d?.rate ?? 17.52, c = d?.cap ?? true; return { nom: fmtRate(n), eff: fmtRate(effFromNom(n, c)), anchor: 'eff' }; });
  const rate = parseRate(rf.nom);
  const changeCap = v => { setCap(v); setRf(r => syncRate(r, v)); };
  const rateCells = html`
    <label class="cell" for="dep-eff"><span class="cell__main"><span>Эффективная</span><span class="cell__sub">ГЭСВ</span></span><input class="cell__input num" id="dep-eff" inputmode="decimal" placeholder="0" value=${rf.eff} onInput=${e => setRf(r => syncRate({ ...r, eff: e.target.value, anchor: 'eff' }, cap))} /><span class="cell__value" style="margin-left:-9px">%</span></label>
    <label class="cell" for="dep-nom"><span class="cell__main">Номинальная</span><input class="cell__input num" id="dep-nom" inputmode="decimal" placeholder="0" value=${rf.nom} onInput=${e => setRf(r => syncRate({ ...r, nom: e.target.value, anchor: 'nom' }, cap))} /><span class="cell__value" style="margin-left:-9px">%</span></label>`;
  const saveRate = () => {
    if (!(rate > 0 && rate < 100)) return ui.toast('Проверьте ставку', null, 'error');
    if (Math.abs(rate - d.rate) > 1e-9) { store.set(s0 => ({ deposits: s0.deposits.map(x => (x.id === d.id ? { ...x, rate } : x)) })); ui.toast(`Ставка: ${rf.eff}% ГЭСВ, ${rf.nom}% номинальная`); }
    close();
  };  const [tick, setTick] = useState(0);
  const amt = numOf(amount);
  const txs = s.tx.filter(t => !t.deletedAt);
  const st = d ? depState(d, txs) : null;
  const end = addMonths(d ? d.start : TODAY, d ? d.term : term);
  const proj = d ? depState(d, txs, end) : amt ? depState({ id: '_', start: TODAY, rate, cap }, [{ dep: '_', type: 'transfer', amount: amt, date: TODAY }], end) : null;
  // проценты «капают» прямо на глазах: начисление в секунду
  const perSec = st ? st.bal * d.rate / 100 / 365 / 86400 : 0;
  useEffect(() => { if (!d || s.settings.motion === 'reduced') return; const t0 = Date.now(); const id = setInterval(() => setTick((Date.now() - t0) / 1000), 100); return () => clearInterval(id); }, []);
  const termP = d ? Math.min(1, diffDays(d.start, TODAY) / Math.max(1, diffDays(d.start, end))) : 0;
  const open = () => {
    if (!name.trim()) return ui.toast('Введите название', null, 'error');
    if (amt < 1000) return ui.toast('Сумма открытия от 1 000 ₸', null, 'error');
    if (!(rate > 0 && rate < 100)) return ui.toast('Укажите ставку', null, 'error');
    close();
    const id = uid();
    mutate(s0 => ({ deposits: [...(s0.deposits || []), { id, name: name.trim(), rate, term, cap, start: TODAY, createdAt: Date.now() }], tx: [...s0.tx, mkTransfer(id, amt, 'Открытие депозита')] }));
    ui.toast(`Депозит открыт: ${money(amt)}`);
  };
  const topUp = () => {
    if (amt < 100) return ui.toast('Введите сумму пополнения', null, 'error');
    mutate(s0 => ({ tx: [...s0.tx, mkTransfer(d.id, amt, 'Пополнение депозита')] }));
    setAmount(''); buzz(12); ui.toast(`Депозит пополнен на ${money(amt)}`);
  };
  const closeDep = () => ui.dialog({ title: 'Закрыть депозит?', msg: `${money(st.bal)} вернутся в свободные деньги, из них ${money(st.interest)} — проценты.`, actions: [{ label: 'Отмена', style: 'bold' }, { label: 'Закрыть', style: 'destructive', run: () => {
    close(); const now = Date.now();
    mutate(s0 => ({ deposits: s0.deposits.map(x => (x.id === d.id ? { ...x, closedAt: now } : x)), tx: [...s0.tx, mkTransfer(d.id, -Math.round(st.put), 'Закрытие депозита'), { id: uid(), type: 'income', cat: 'interest', amount: Math.round(st.interest), date: TODAY, note: `Проценты: ${d.name}`, createdAt: now, updatedAt: now, deletedAt: null }] }));
    ui.toast('Депозит закрыт, деньги вернулись');
  } }] });
  const moneyField = html`<label class="input input--money" for="dep-amount"><input id="dep-amount" inputmode="numeric" placeholder="0" value=${amount} onInput=${e => setAmount(digitsOnly(e.target.value))} /><span class="input__suffix">₸</span></label>
    <div class="row-scroll" style="margin-top:10px">${[10000, 50000, 100000, 300000].map(v => html`<button class="capsule" aria-pressed=${String(amt === v)} onClick=${() => setAmount(fmt(v))}>${fmt(v)} ₸</button>`)}</div>`;
  if (isNew) return html`<${SheetNav} title="Новый депозит" onCancel=${close} done="Открыть" onDone=${open} />
    <div class="sheet__body">
      <div class="section"><div class="section__header">Сумма открытия</div>${moneyField}</div>
      <div class="section"><div class="section__header">Условия</div><div class="group">
        <label class="cell" for="dep-name"><span>Название</span><input class="cell__input" id="dep-name" value=${name} onInput=${e => setName(e.target.value)} /></label>
        <div class="cell"><span class="cell__main">Срок, мес.</span><${Seg} items=${[[3, '3'], [6, '6'], [12, '12'], [24, '24']]} value=${term} onChange=${setTerm} style="width:180px" /></div>
        <div class="cell"><span class="cell__main">Капитализация</span><${Switch} on=${cap} onChange=${changeCap} label="Капитализация" /></div>
      </div></div>
      <div class="section"><div class="section__header">Ставка</div><div class="group">${rateCells}</div>
        <div class="section__footer">В приложении банка обычно указаны обе. Введите любую — вторая посчитается. ${cap ? 'С ежемесячной капитализацией 19% ГЭСВ = 17,52% номинальной.' : 'Без капитализации они совпадают.'}</div></div>
      ${proj && rate > 0 && html`<div class="banner banner--success"><${Icon} n="trending_up" /><div class="banner__main"><b>≈ ${money(proj.bal)} через ${term} мес.</b><span>Доход ${money(proj.bal - amt)} при ${rf.eff}% ГЭСВ, если не пополнять.</span></div></div>`}
    </div>`;
  return html`<${SheetNav} title=${d.name} onCancel=${close} cancel="Закрыть" done="Готово" onDone=${saveRate} />
    <div class="sheet__body">
      <div class="card" style="justify-items:center;text-align:center">
        <div class="metric__label">На депозите</div>
        <div class="metric__v">${fmt(st.bal + perSec * tick)}<small>₸</small></div>
        <div class="metric__sub num" style="color:var(--green)">+${(st.interest + perSec * tick).toFixed(2).replace('.', ',')} ₸ процентов</div>
        <div class="progress" style=${`width:100%;--p:${termP};--c:var(--green)`}><i></i></div>
        <div class="metric__sub">${fmtRate(effFromNom(d.rate, d.cap))}% ГЭСВ · ${fmtRate(d.rate)}% номинальная</div>
        <div class="metric__sub">До ${dateLong(end)} ${parse(end).getFullYear()} · к концу срока ≈ ${money(proj.bal)}</div>
      </div>
      <div class="section"><div class="section__header">Пополнить</div>${moneyField}<button class="btn btn--filled btn--block" style="margin-top:12px" onClick=${topUp}>Пополнить</button></div>
      <div class="group">
        ${rateCells}
        <div class="cell"><span class="cell__main">Капитализация</span><span class="cell__value">${d.cap ? 'Ежемесячно' : 'Нет'}</span></div>
        <div class="cell"><span class="cell__main">Вложено</span><span class="cell__value">${money(st.put)}</span></div>
        <div class="cell"><span class="cell__main">Открыт</span><span class="cell__value">${dateLong(d.start)} ${parse(d.start).getFullYear()}</span></div>
      </div>
      <div class="section"><div class="section__header">История</div><div class="group">
        ${[...st.ops].reverse().map(t => html`<div class="cell"><span class="cell__main"><span>${t.note}</span><span class="cell__sub">${dateLong(t.date)}</span></span><span class="amt">${t.amount > 0 ? '+' : '−'}${fmt(Math.abs(t.amount))} ₸</span></div>`)}
      </div></div>
      <div class="group"><button class="cell cell--destructive" onClick=${closeDep}>Закрыть депозит</button></div>
    </div>`;
}
