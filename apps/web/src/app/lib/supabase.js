import { createClient } from '@supabase/supabase-js';
import { config, cloudEnabled } from '../config.js';

export const supabase = cloudEnabled()
  ? createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'grosh.auth' },
    })
  : null;

// Понятные тексты вместо сообщений сервера
const MESSAGES = [
  [/invalid login credentials/i, 'Неверная почта или пароль'],
  [/user already registered|already been registered/i, 'Этот адрес уже зарегистрирован. Войдите.'],
  [/email not confirmed/i, 'Почта ещё не подтверждена. Откройте письмо и нажмите ссылку.'],
  [/password should be at least/i, 'Пароль слишком короткий'],
  [/weak password|pwned/i, 'Пароль слишком простой или встречался в утечках. Придумайте другой.'],
  [/rate limit|too many/i, 'Слишком много попыток. Подождите минуту.'],
  [/unable to validate email|invalid.*email/i, 'Похоже, в адресе опечатка'],
  [/provider is not enabled|unsupported provider/i, 'Этот способ входа ещё не включён на сервере'],
  [/failed to fetch|network/i, 'Нет соединения с сервером. Проверьте интернет.'],
  [/same password|different from the old/i, 'Новый пароль должен отличаться от старого'],
];
export const authMessage = err => {
  const m = String(err?.message || err || '');
  return (MESSAGES.find(([re]) => re.test(m)) || [, 'Что-то пошло не так. Попробуйте ещё раз.'])[1];
};
