import { TODAY, addDays, cap, fmt, iso, parse, uid } from './dates.js';

export const addMonths = (s, n, day) => { const d = parse(s), y = d.getFullYear(), m = d.getMonth() + n; return iso(new Date(y, m, Math.min(day ?? d.getDate(), new Date(y, m + 1, 0).getDate()))); };
export const instSchedule = it => { const base = Math.round(it.total / it.months), day = parse(it.first).getDate(); return [...Array(it.months)].map((_, k) => ({ k, date: addMonths(it.first, k, day), amount: k === it.months - 1 ? it.total - base * (it.months - 1) : base })); };
export function instState(it, txs) {
  const sch = instSchedule(it);
  const paid = new Set(sch.filter(p => p.k < it.paidBefore || txs.some(t => t.inst === it.id && t.k === p.k && !t.deletedAt)).map(p => p.k));
  const next = sch.find(p => !paid.has(p.k));
  const left = sch.filter(p => !paid.has(p.k)).reduce((a, p) => a + p.amount, 0);
  return { sch, paid, paidN: paid.size, next, left, done: paid.size === it.months, monthly: Math.round(it.total / it.months) };
}
// id платежа выводится из id рассрочки и номера: два устройства создадут одну и ту же запись, а не дубль
export const paymentId = (instId, k) => instId.slice(0, 28) + ((parseInt(instId.slice(28), 16) ^ (k + 1)) >>> 0).toString(16).padStart(8, '0');
// платёж по рассрочке списывается сам в день оплаты; удалённый вручную больше не создаётся
export function instDue(s) {
  const out = [];
  for (const it of s.installments || []) for (const p of instSchedule(it)) {
    if (p.k < it.paidBefore || p.date > TODAY || s.tx.some(t => t.inst === it.id && t.k === p.k)) continue;
    const c = parse(p.date); c.setHours(9, 0);
    out.push({ id: paymentId(it.id, p.k), type: 'expense', cat: 'loan', amount: p.amount, date: p.date, note: `${it.name} · ${p.k + 1} из ${it.months}`, inst: it.id, k: p.k, createdAt: c.getTime(), updatedAt: c.getTime(), deletedAt: null });
  }
  return out;
}
// проценты начисляются каждый день, при капитализации раз в месяц прибавляются к телу
export function depState(dp, txs, until = TODAY) {
  const ops = txs.filter(t => t.dep === dp.id && t.type === 'transfer' && !t.deletedAt).sort((a, b) => a.date.localeCompare(b.date));
  const end = dp.closedAt ? iso(new Date(dp.closedAt)) : until;
  const startDay = parse(dp.start).getDate();
  let bal = 0, pend = 0, interest = 0, put = 0, i = 0;
  for (let d = parse(dp.start); iso(d) <= end; d = addDays(d, 1)) {
    const ds = iso(d);
    while (i < ops.length && ops[i].date <= ds) { bal += ops[i].amount; put += ops[i].amount; i++; }
    const day = Math.max(0, bal) * dp.rate / 100 / 365;
    pend += day; interest += day;
    const nd = addDays(d, 1);
    if (dp.cap && nd.getDate() === Math.min(startDay, new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate())) { bal += pend; pend = 0; }
  }
  return { bal: bal + pend, put, interest, ops };
}
// ГЭСВ (эффективная) ↔ номинальная: при ежемесячной капитализации эфф = (1 + ном/12)^12 − 1
export const effFromNom = (n, cap) => cap ? (Math.pow(1 + n / 1200, 12) - 1) * 100 : n;
export const nomFromEff = (e, cap) => cap ? 12 * (Math.pow(1 + e / 100, 1 / 12) - 1) * 100 : e;
export const parseRate = v => +String(v).replace(',', '.').replace(/[^\d.]/g, '') || 0;
export const fmtRate = n => String(Math.round(n * 100) / 100).replace('.', ',');
export const syncRate = (r, cap) => r.anchor === 'eff' ? { ...r, nom: fmtRate(nomFromEff(parseRate(r.eff), cap)) } : { ...r, eff: fmtRate(effFromNom(parseRate(r.nom), cap)) };
export const mkTransfer = (dep, amount, note, date = TODAY) => { const c = parse(date); if (date === TODAY) c.setTime(Date.now()); else c.setHours(10, 0); return { id: uid(), type: 'transfer', cat: 'deposit', dep, amount, date, note, createdAt: c.getTime(), updatedAt: c.getTime(), deletedAt: null }; };

export const digitsOnly = v => { const d = String(v).replace(/\D/g, '').slice(0, 10); return d ? fmt(+d) : ''; };
export const numOf = v => +String(v).replace(/\D/g, '') || 0;
