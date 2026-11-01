import { NOW, TODAY, addDays, cap, iso, pRange, parse, uid } from './dates.js';
import { CATS } from './categories.js';
import { instDue, mkTransfer } from './finance.js';
import { ACH, evaluate } from './achievements.js';
import { SCHEMA } from '../state/store.js';

export function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const NOTES = {
  food: ['Продукты на неделю', 'Овощи и фрукты', 'Хлеб и молоко', 'Супермаркет у дома', 'Мясо на выходные'],
  cafe: ['Кофе с собой', 'Обед с коллегами', 'Завтрак', 'Кофе и круассан', 'Ужин с друзьями'],
  taxi: ['Домой из офиса', 'В офис, опаздывал', 'Из гостей', 'До торгового центра', 'В аэропорт'],
  fun: ['Кино', 'Боулинг', 'Концерт', 'Новая игра'],
  health: ['Аптека', 'Стоматолог', 'Анализы'],
  clothes: ['Кроссовки', 'Куртка', 'Футболки'],
  gifts: ['Подарок маме', 'День рождения друга'],
  other: ['Стрижка', 'Химчистка', 'Канцелярия'],
};
export function seedTx() {
  const r = rng(11), out = [];
  const between = (a, b, step = 50) => Math.round((a + r() * (b - a)) / step) * step;
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const add = (date, type, cat, amount, note) => {
    if (amount === 10000) amount = 10050; // «Перфекционист» оставляем на открытие вручную
    const c = parse(date); c.setHours(8 + Math.floor(r() * 14), Math.floor(r() * 60));
    out.push({ id: uid(), type, cat, amount, date, note, createdAt: c.getTime(), updatedAt: c.getTime(), deletedAt: null });
  };
  for (let i = 94; i >= 0; i--) {
    const d = addDays(NOW, -i), s = iso(d), dom = d.getDate();
    if (dom === 1) add(s, 'expense', 'home', 180000, 'Аренда квартиры');
    if (dom === 5) add(s, 'income', 'salary', 720000, 'Зарплата');
    if (dom === 20 && r() < .75) add(s, 'income', 'freelance', between(60000, 150000, 5000), 'Проект для клиента');
    if (dom === 25) add(s, 'income', 'cashback', between(4000, 9000, 10), 'Кэшбэк за месяц');
    if (dom === 12) add(s, 'expense', 'phone', 4500, 'Связь и интернет');
    if (dom === 15) add(s, 'expense', 'subs', 2990, 'Музыка');
    if (dom === 18) add(s, 'expense', 'subs', 1490, 'Облачное хранилище');
    if (i === 0) { add(s, 'expense', 'cafe', 1600, 'Кофе с собой'); continue; }
    if (r() < .08) continue; // день без трат
    if (r() < .45) add(s, 'expense', 'food', between(3500, 16000), pick(NOTES.food));
    if (r() < .35) add(s, 'expense', 'cafe', between(1800, 7500), pick(NOTES.cafe));
    const taxiP = i > 60 ? .6 : i > 30 ? .4 : .15;
    if (r() < taxiP) add(s, 'expense', 'taxi', between(900, 3800), pick(NOTES.taxi));
    if (r() < taxiP * .35) add(s, 'expense', 'taxi', between(900, 3200), pick(NOTES.taxi));
    if (r() < .2) add(s, 'expense', 'transport', r() < .5 ? 250 : 500, 'Автобус');
    if (r() < .07) add(s, 'expense', 'fun', between(3000, 15000), pick(NOTES.fun));
    if (r() < .05) add(s, 'expense', 'health', between(2000, 12000), pick(NOTES.health));
    if (r() < .03) add(s, 'expense', 'clothes', between(9000, 35000, 500), pick(NOTES.clothes));
    if (r() < .025) add(s, 'expense', 'gifts', between(5000, 20000, 500), pick(NOTES.gifts));
    if (r() < .05) add(s, 'expense', 'other', between(1500, 6000), pick(NOTES.other));
  }
  return out;
}

/** Пустой учёт: только стандартные категории. С него начинается настоящее приложение. */
export function makeEmpty() {
  return {
    v: SCHEMA,
    profile: { name: '', color: 'blue', since: TODAY, showcase: [] },
    settings: { theme: 'system', monthStart: 1, weekStart: 1, motion: 'full', haptics: true },
    categories: CATS, challenges: [], installments: [], deposits: [], tx: [],
    meta: { backups: 0, lastBackupAt: null, calcUsed: false, recapSeen: null, ach: {}, demo: false, onboarded: false },
  };
}

/** Пример за три месяца — чтобы посмотреть приложение в деле. */
export function makeDemo() {
  const tx = seedTx();
  const first = tx.reduce((m, t) => (t.date < m ? t.date : m), TODAY);
  const s = {
    v: SCHEMA,
    profile: { name: 'Денис', color: 'blue', since: first, showcase: ['walk', 'taxo', 'piggy'] },
    settings: { theme: 'system', monthStart: 1, weekStart: 1, motion: 'full', haptics: true },
    categories: CATS,
    challenges: [
      { id: uid(), cat: 'taxi', limit: 20000, createdAt: parse(first).getTime() },
      { id: uid(), cat: 'cafe', limit: 40000, createdAt: parse(first).getTime() },
    ],
    tx,
    meta: { backups: 0, lastBackupAt: null, calcUsed: false, recapSeen: null, ach: {}, demo: true, onboarded: false },
  };
  // рассрочки: телефон в процессе, холодильник уже выплачен; депозит с пополнениями 6-го числа
  s.installments = [
    { id: uid(), name: 'iPhone 16', total: 540000, months: 12, first: iso(new Date(NOW.getFullYear(), NOW.getMonth() - 3, 10)), paidBefore: 0, createdAt: parse(first).getTime() },
    { id: uid(), name: 'Холодильник', total: 360000, months: 6, first: iso(new Date(NOW.getFullYear(), NOW.getMonth() - 6, 15)), paidBefore: 3, createdAt: parse(first).getTime() },
  ];
  const depStart = iso(addDays(NOW, -70)), depId = uid();
  s.deposits = [{ id: depId, name: 'Накопительный', rate: 17.52, term: 12, cap: true, start: depStart, createdAt: parse(depStart).getTime() }];
  s.tx = [...s.tx, ...instDue(s), mkTransfer(depId, 300000, 'Открытие депозита', depStart)];
  for (let d = addDays(parse(depStart), 1); iso(d) <= TODAY; d = addDays(d, 1)) if (d.getDate() === 6) s.tx.push(mkTransfer(depId, 50000, 'Пополнение депозита', iso(d)));
  const { c, res } = evaluate(s);
  for (const a of ACH) {
    const r = res[a.id];
    if (r.tier || r.count) s.meta.ach[a.id] = { tier: r.tier, count: r.count || 0, at: a.monthly ? parse(pRange(r.periods.at(-1), c.ms)[1]).getTime() : parse(first).getTime() };
  }
  return s;
}
