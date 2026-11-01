

export const pad2 = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const NOW = new Date();
export const TODAY = iso(NOW);
export const YESTERDAY = iso(addDays(NOW, -1));
export const nf = new Intl.NumberFormat('ru-RU');
export const fmt = n => nf.format(Math.round(n));
export const money = n => fmt(n) + ' ₸';
export const kfmt = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'м' : n >= 1000 ? Math.round(n / 1000) + 'к' : String(Math.round(n));
export const M_NOM = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
export const M_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
export const M_PREP = ['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
export const M_INS = ['январём','февралём','мартом','апрелем','маем','июнем','июлем','августом','сентябрём','октябрём','ноябрём','декабрём'];
export const WD = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
export const WD_LONG = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
export const cap = s => s[0].toUpperCase() + s.slice(1);
export const dateLong = s => `${parse(s).getDate()} ${M_GEN[parse(s).getMonth()]}`;
export const dayTitle = s => s === TODAY ? 'Сегодня' : s === YESTERDAY ? 'Вчера' : `${dateLong(s)}, ${WD_LONG[parse(s).getDay()]}`;
export const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; return n > 10 && n < 20 ? c : n1 > 1 && n1 < 5 ? b : n1 === 1 ? a : c; };
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
// без имени вернёт пустую строку — тогда в аватарке показываем иконку человека
export const initials = name => (name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// «финансовый месяц» может начинаться не с 1-го числа
export const pKey = (s, ms) => { const d = parse(s); let y = d.getFullYear(), m = d.getMonth(); if (d.getDate() < ms) { m--; if (m < 0) { m = 11; y--; } } return y * 12 + m; };
export const pRange = (k, ms) => { const y = Math.floor(k / 12), m = k % 12; return [iso(new Date(y, m, ms)), iso(addDays(new Date(y, m + 1, ms), -1))]; };
