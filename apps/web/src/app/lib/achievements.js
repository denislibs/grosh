import { TODAY, YESTERDAY, addDays, fmt, iso, kfmt, pKey, pRange, parse } from './dates.js';
import { depState, instState } from './finance.js';

export function buildCtx(s) {
  const ms = s.settings.monthStart;
  const txs = s.tx.filter(t => !t.deletedAt);
  const days = new Map(), per = new Map();
  let inc = 0, exp = 0, tr = 0;
  for (const t of txs) {
    let d = days.get(t.date); if (!d) { d = { exp: 0, inc: 0, n: 0, taxi: 0 }; days.set(t.date, d); }
    d.n++;
    const k = pKey(t.date, ms);
    let p = per.get(k); if (!p) { p = { exp: 0, inc: 0, byCat: {}, incCats: new Set(), wd: [0, 0, 0, 0, 0, 0, 0], n: 0 }; per.set(k, p); }
    p.n++;
    if (t.type === 'expense') {
      d.exp += t.amount; p.exp += t.amount; exp += t.amount;
      p.byCat[t.cat] = (p.byCat[t.cat] || 0) + t.amount;
      p.wd[parse(t.date).getDay()] += t.amount;
      if (t.cat === 'taxi') d.taxi += t.amount;
    } else if (t.type === 'income') { d.inc += t.amount; p.inc += t.amount; inc += t.amount; p.incCats.add(t.cat); }
    else if (t.type === 'transfer') { tr += t.amount; p.tr = (p.tr || 0) + t.amount; }
  }
  const first = txs.reduce((m, t) => (t.date < m ? t.date : m), TODAY);
  const cur = pKey(TODAY, ms);
  const done = [...per.keys()].filter(k => k < cur).sort((a, b) => a - b);
  return { s, ms, txs, days, per, first, cur, done, inc, exp, tr };
}
export function runs(c, pred, until = TODAY) {
  let best = 0, cur = 0;
  for (let d = parse(c.first); iso(d) <= until; d = addDays(d, 1)) { if (pred(iso(d))) { cur++; best = Math.max(best, cur); } else cur = 0; }
  return { best, cur };
}
export const streakNow = c => c.days.has(TODAY) ? runs(c, s => c.days.has(s)).cur : runs(c, s => c.days.has(s), YESTERDAY).cur;
export const zeroDays = c => { const out = []; for (let d = parse(c.first); iso(d) < TODAY; d = addDays(d, 1)) if (!(c.days.get(iso(d))?.exp)) out.push(iso(d)); return out; };

export const ACH = [
  { id: 'first', g: 'habit', i: 'flag', n: 'Первый шаг', d: 'Добавьте первую запись', tiers: [1], v: c => c.txs.length },
  { id: 'chron', g: 'habit', i: 'edit_calendar', n: 'Летописец', d: 'Записывайте траты каждый день подряд', tiers: [7, 30, 100], unit: 'дн. подряд', v: c => runs(c, s => c.days.has(s)).best },
  { id: 'fullm', g: 'habit', i: 'event_available', n: 'Ни дня без строчки', d: 'Записи в каждый день месяца', monthly: true, p: (c, k) => { const [a, b] = pRange(k, c.ms); for (let d = parse(a); iso(d) <= b; d = addDays(d, 1)) if (!c.days.has(iso(d))) return false; return true; } },
  { id: 'time', g: 'habit', i: 'history', n: 'Путешественник во времени', d: 'Добавьте запись за дату больше месяца назад', tiers: [1], v: c => c.txs.some(t => t.createdAt - parse(t.date).getTime() > 31 * 864e5) ? 1 : 0 },
  { id: 'econ', g: 'save', i: 'trending_down', n: 'Экономист', d: 'Потратьте меньше, чем в прошлом месяце', monthly: true, p: (c, k) => c.per.has(k - 1) && c.per.get(k).exp < c.per.get(k - 1).exp },
  { id: 'piggy', g: 'save', i: 'savings', n: 'Копилка', d: 'Отложите часть дохода за месяц', tiers: [10, 20, 30], unit: '% дохода', v: c => Math.max(0, ...c.done.map(k => { const p = c.per.get(k); return p.inc > 0 ? Math.floor((p.inc - p.exp) / p.inc * 100) : 0; })) },
  { id: 'iron', g: 'save', i: 'shield', n: 'Железная воля', d: 'Три месяца подряд доход больше расходов', tiers: [3], unit: 'мес. подряд', v: c => { let b = 0, r = 0, prev = null; for (const k of c.done) { const p = c.per.get(k); r = p.inc > p.exp ? (prev !== null && k === prev + 1 ? r + 1 : 1) : 0; prev = k; b = Math.max(b, r); } return b; } },
  { id: 'zero', g: 'save', i: 'do_not_disturb_on', n: 'Нулевой день', d: 'Проживите день без трат', tiers: [1], v: c => zeroDays(c).length },
  { id: 'monk', g: 'save', i: 'self_improvement', n: 'Монах', d: 'Семь дней без трат за один месяц', tiers: [7], unit: 'дн. без трат', v: c => { const m = {}; for (const d of zeroDays(c)) { const k = pKey(d, c.ms); m[k] = (m[k] || 0) + 1; } return Math.max(0, ...Object.values(m)); } },
  { id: 'mill', g: 'save', i: 'diamond', n: 'Миллионер', d: 'Сэкономьте миллион тенге за всё время', tiers: [1000000], unit: '₸', v: c => Math.max(0, c.inc - c.exp) },
  { id: 'depo', g: 'save', i: 'account_balance', n: 'Вкладчик', d: 'Откройте депозит', tiers: [1], v: c => (c.s.deposits || []).length },
  { id: 'capital', g: 'save', i: 'account_balance_wallet', n: 'Капитал', d: 'Накопите на депозитах', tiers: [500000, 1000000, 3000000], unit: '₸', v: c => Math.round((c.s.deposits || []).filter(d => !d.closedAt).reduce((a, d) => a + depState(d, c.txs).bal, 0)) },
  { id: 'debtfree', g: 'save', i: 'task_alt', n: 'Без долгов', d: 'Полностью выплатите рассрочку', tiers: [1], v: c => (c.s.installments || []).filter(it => instState(it, c.txs).done).length },
  { id: 'chef', g: 'cat', i: 'restaurant', n: 'Шеф-повар', d: 'За месяц на кафе ушло меньше, чем на продукты', monthly: true, p: (c, k) => { const b = c.per.get(k).byCat; return (b.food || 0) > 0 && (b.cafe || 0) < b.food; } },
  { id: 'walk', g: 'cat', i: 'directions_walk', n: 'Пешеход', d: 'Дни подряд без такси', tiers: [7, 14, 30], unit: 'дн. без такси', taxi: true, v: c => runs(c, s => !(c.days.get(s)?.taxi)).best },
  { id: 'taxo', g: 'cat', i: 'local_taxi', n: 'Таксофоб', d: 'На такси меньше, чем в прошлом месяце', monthly: true, taxi: true, p: (c, k) => c.per.has(k - 1) && (c.per.get(k).byCat.taxi || 0) < (c.per.get(k - 1).byCat.taxi || 0) },
  { id: 'coffee', g: 'cat', i: 'local_cafe', n: 'Кофеман', d: '30 записей в категории «Кафе»', tiers: [30], unit: 'записей', v: c => c.txs.filter(t => t.cat === 'cafe').length },
  { id: 'tamer', g: 'cat', i: 'military_tech', n: 'Укротитель', d: 'Уложитесь в лимит любого челленджа за месяц', monthly: true, p: (c, k) => c.s.challenges.some(ch => ch.createdAt <= parse(pRange(k, c.ms)[1]).getTime() + 864e5 && (c.per.get(k).byCat[ch.cat] || 0) <= ch.limit) },
  { id: 'salary', g: 'inc', i: 'work', n: 'Первая зарплата', d: 'Добавьте первый доход', tiers: [1], v: c => c.txs.filter(t => t.type === 'income').length },
  { id: 'multi', g: 'inc', i: 'hub', n: 'Многостаночник', d: 'Доходы из трёх разных источников за месяц', tiers: [3], unit: 'источника', v: c => Math.max(0, ...[...c.per.values()].map(p => p.incCats.size)) },
  { id: 'growth', g: 'inc', i: 'trending_up', n: 'Рост', d: 'Доход больше, чем в прошлом месяце', monthly: true, p: (c, k) => c.per.has(k - 1) && c.per.get(k).inc > c.per.get(k - 1).inc },
  { id: 'keeper', g: 'secret', i: 'backup', n: 'Хранитель', d: 'Сделайте бэкап данных', tiers: [1, 5], unit: 'бэкапов', v: c => c.s.meta.backups || 0 },
  { id: 'owl', g: 'secret', hidden: true, i: 'bedtime', n: 'Сова', d: 'Запись между полуночью и пятью утра', tiers: [1], v: c => c.txs.some(t => new Date(t.createdAt).getHours() < 5) ? 1 : 0 },
  { id: 'perfect', g: 'secret', hidden: true, i: 'adjust', n: 'Перфекционист', d: 'Сумма ровно 10 000 ₸', tiers: [1], v: c => c.txs.some(t => t.amount === 10000) ? 1 : 0 },
  { id: 'calc', g: 'secret', hidden: true, i: 'calculate', n: 'Калькулятор', d: 'Посчитайте сумму прямо на клавиатуре', tiers: [1], v: c => c.s.meta.calcUsed ? 1 : 0 },
  { id: 'friday', g: 'secret', hidden: true, i: 'celebration', n: 'Пятница', d: 'Больше всего трат за месяц пришлось на пятницы', monthly: true, p: (c, k) => { const w = c.per.get(k).wd; return w.indexOf(Math.max(...w)) === 5; } },
];
export const ACH_BY = Object.fromEntries(ACH.map(a => [a.id, a]));
export const GROUPS = [['habit', 'Привычка'], ['save', 'Экономия'], ['cat', 'Категории'], ['inc', 'Доход'], ['secret', 'Секретные']];

export function evaluate(s) {
  const c = buildCtx(s), res = {};
  for (const a of ACH) {
    if (a.monthly) { const periods = c.done.filter(k => a.p(c, k)); res[a.id] = { tier: periods.length ? 1 : 0, count: periods.length, periods }; }
    else { const v = a.v(c); const tier = a.tiers.filter(t => v >= t).length; res[a.id] = { tier, value: v, next: a.tiers[tier] ?? null }; }
  }
  return { c, res };
}
export const tierClass = (a, tier) => {
  if (!tier) return 'locked';
  if (a.monthly) return 'gold';
  const n = a.tiers.length;
  return (n === 1 ? ['gold'] : n === 2 ? ['silver', 'gold'] : ['bronze', 'silver', 'gold'])[tier - 1];
};
export const TIER_NAMES = { bronze: 'бронза', silver: 'серебро', gold: 'золото' };
export const progressText = (a, r) => {
  if (a.monthly) return r.count ? `Получено ×${r.count}` : 'Подводится в конце месяца';
  if (r.next == null) return 'Максимум';
  const v = a.unit === '₸' ? kfmt(r.value) : fmt(Math.min(r.value, r.next));
  return `${v} из ${a.unit === '₸' ? kfmt(r.next) : fmt(r.next)}${a.unit && a.unit !== '₸' ? ' ' + a.unit : ''}`;
};
