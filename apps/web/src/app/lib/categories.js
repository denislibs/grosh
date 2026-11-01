

export const CATS = [
  ['food', 'expense', 'Продукты', 'shopping_cart', 'orange'],
  ['cafe', 'expense', 'Кафе', 'local_cafe', 'brown'],
  ['taxi', 'expense', 'Такси', 'local_taxi', 'yellow'],
  ['transport', 'expense', 'Транспорт', 'directions_bus', 'blue'],
  ['home', 'expense', 'Дом', 'home', 'indigo'],
  ['health', 'expense', 'Здоровье', 'medication', 'pink'],
  ['fun', 'expense', 'Развлечения', 'movie', 'mint'],
  ['clothes', 'expense', 'Одежда', 'checkroom', 'teal'],
  ['subs', 'expense', 'Подписки', 'autorenew', 'cyan'],
  ['phone', 'expense', 'Связь', 'smartphone', 'gray'],
  ['gifts', 'expense', 'Подарки', 'redeem', 'red'],
  ['loan', 'expense', 'Рассрочки', 'credit_card', 'purple'],
  ['other', 'expense', 'Другое', 'more_horiz', 'gray'],
  ['salary', 'income', 'Зарплата', 'work', 'green'],
  ['freelance', 'income', 'Фриланс', 'laptop_mac', 'mint'],
  ['cashback', 'income', 'Кэшбэк', 'percent', 'orange'],
  ['gift_in', 'income', 'Подарки', 'redeem', 'red'],
  ['interest', 'income', 'Проценты', 'percent', 'teal'],
  ['other_in', 'income', 'Другое', 'more_horiz', 'gray'],
  ['deposit', 'transfer', 'Депозит', 'account_balance', 'green'],
].map(([id, type, name, icon, color], order) => ({ id, type, name, icon, color, order, archived: false }));
export const COLORS = ['red', 'orange', 'yellow', 'green', 'mint', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown', 'gray'];
export const ICONS = ['shopping_cart', 'local_cafe', 'local_taxi', 'directions_bus', 'home', 'medication', 'movie', 'checkroom', 'autorenew', 'smartphone', 'redeem', 'more_horiz', 'restaurant', 'local_bar', 'pets', 'sports_esports', 'menu_book', 'flight', 'local_gas_station', 'content_cut', 'fitness_center', 'music_note', 'lightbulb', 'work', 'laptop_mac', 'percent', 'savings', 'account_balance', 'school', 'child_care'];
