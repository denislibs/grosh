import { describe, it, expect } from 'vitest';
import { effFromNom, nomFromEff, syncRate, instSchedule, instState, depState, paymentId, addMonths } from './finance.js';
import { pKey, pRange } from './dates.js';

describe('ставки депозита', () => {
  it('17,52% номинальных с ежемесячной капитализацией = 19% ГЭСВ (как в Kaspi)', () => {
    expect(effFromNom(17.52, true)).toBeCloseTo(19.0, 1);
    expect(nomFromEff(19, true)).toBeCloseTo(17.52, 2);
  });
  it('без капитализации ставки совпадают', () => {
    expect(effFromNom(14, false)).toBe(14);
    expect(nomFromEff(14, false)).toBe(14);
  });
  it('пересчёт держит «якорем» поле, которое вводили последним', () => {
    expect(syncRate({ eff: '19', nom: '', anchor: 'eff' }, true).nom).toBe('17,52');
    expect(syncRate({ eff: '', nom: '17,52', anchor: 'nom' }, true).eff).toBe('19');
  });
});

describe('рассрочка', () => {
  it('платежи равны и в сумме дают цену покупки', () => {
    const s = instSchedule({ total: 540000, months: 12, first: '2026-08-10' });
    expect(s).toHaveLength(12);
    expect(s.every(p => p.amount === 45000)).toBe(true);
    expect(s[11].date).toBe('2027-07-10');
  });
  it('остаток от деления уходит в последний платёж', () => {
    const s = instSchedule({ total: 100000, months: 3, first: '2026-01-05' });
    expect(s.map(p => p.amount)).toEqual([33333, 33333, 33334]);
    expect(s.reduce((a, p) => a + p.amount, 0)).toBe(100000);
  });
  it('31-е число переносится на последний день короткого месяца', () => {
    expect(addMonths('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(instSchedule({ total: 300, months: 3, first: '2026-01-31' }).map(p => p.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
  it('учитывает платежи, оплаченные до начала учёта', () => {
    const it0 = { id: 'x', total: 360000, months: 6, first: '2026-05-15', paidBefore: 3 };
    const st = instState(it0, []);
    expect(st.paidN).toBe(3);
    expect(st.left).toBe(180000);
    expect(st.next.date).toBe('2026-08-15');
  });
  it('id платежа одинаковый на всех устройствах и это валидный UUID', () => {
    const id = '8d95fc9b-ec9b-4b49-99f9-a7dd237741d9';
    const ids = [...Array(24)].map((_, k) => paymentId(id, k));
    expect(new Set(ids).size).toBe(24);
    expect(paymentId(id, 5)).toBe(paymentId(id, 5));
    ids.forEach(x => expect(x).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/));
  });
});

describe('депозит', () => {
  const tx = (amount, date) => ({ dep: 'd', type: 'transfer', amount, date });
  it('400 000 ₸ под 19% ГЭСВ за год дают ≈ 476 000 ₸', () => {
    const d = { id: 'd', start: '2026-01-01', rate: 17.52, cap: true };
    const st = depState(d, [tx(400000, '2026-01-01')], '2026-12-31');
    expect(st.bal / 400000 - 1).toBeCloseTo(0.19, 2);
    expect(st.put).toBe(400000);
  });
  it('без капитализации проценты простые', () => {
    const d = { id: 'd', start: '2026-01-01', rate: 12, cap: false };
    const st = depState(d, [tx(100000, '2026-01-01')], '2026-12-31');
    expect(st.interest).toBeCloseTo(12000, -1);
  });
  it('закрытый депозит перестаёт начислять', () => {
    const d = { id: 'd', start: '2026-01-01', rate: 12, cap: false, closedAt: new Date(2026, 0, 31).getTime() };
    expect(depState(d, [tx(100000, '2026-01-01')], '2026-12-31').interest).toBeLessThan(1100);
  });
});

describe('финансовый месяц', () => {
  it('с 10-го числа: 9 ноября ещё октябрь', () => {
    expect(pKey('2026-11-09', 10)).toBe(2026 * 12 + 9);
    expect(pKey('2026-11-10', 10)).toBe(2026 * 12 + 10);
    expect(pRange(2026 * 12 + 9, 10)).toEqual(['2026-10-10', '2026-11-09']);
  });
});
