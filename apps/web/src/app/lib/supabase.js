import { createClient } from '@supabase/supabase-js';
import { config, cloudEnabled } from '../config.js';

export const supabase = cloudEnabled()
  ? createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'grosh.auth', experimental: { passkey: true } },
    })
  : null;

// Понятные тексты вместо сообщений сервера
const MESSAGES = [
  [/invalid login credentials/i, 'Неверная почта или пароль'],
  [/user already registered|already been registered/i, 'Этот адрес уже зарегистрирован. Войдите.'],
  [/email not confirmed/i, 'Почта ещё не подтверждена. Откройте письмо и нажмите ссылку.'],
  [/password should be at least/i, 'Пароль слишком короткий'],
  [/weak password|pwned/i, 'Пароль слишком простой или встречался в утечках. Придумайте другой.'],
  [/only request this after|security purposes/i, 'Письмо уже отправлено. Повторить можно через минуту.'],
  [/rate limit|too many/i, 'Слишком много попыток. Подождите минуту.'],
  [/unable to validate email|invalid.*email/i, 'Похоже, в адресе опечатка'],
  [/signups not allowed for otp|otp.*disabled/i, 'Вход по ссылке пока не включён на сервере'],
  [/provider is not enabled|unsupported provider/i, 'Этот способ входа ещё не включён на сервере'],
  [/failed to fetch|network/i, 'Нет соединения с сервером. Проверьте интернет.'],
  [/same password|different from the old/i, 'Новый пароль должен отличаться от старого'],
];
/** Ключи доступа (WebAuthn) поддерживаются этим браузером. */
export const passkeySupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential;

/** Текст ошибки ключа доступа; null — пользователь сам отменил, сообщать нечего. */
export const passkeyMessage = err => {
  const m = String(err?.message || err || ''), code = err?.code || '';
  if (err?.name === 'NotAllowedError' || err?.name === 'AbortError' || /cancel|abort|not allowed|timed out/i.test(m)) return null;
  const map = {
    passkey_disabled: 'Вход по ключу доступа пока не включён на сервере',
    webauthn_credential_not_found: 'Этот ключ не найден. Войдите по почте и добавьте ключ в настройках.',
    webauthn_credential_exists: 'Этот ключ уже добавлен',
    too_many_passkeys: 'Достигнут предел ключей. Удалите ненужный и попробуйте снова.',
    webauthn_challenge_expired: 'Время ожидания вышло. Попробуйте ещё раз.',
    webauthn_challenge_not_found: 'Время ожидания вышло. Попробуйте ещё раз.',
    webauthn_verification_failed: 'Не удалось проверить ключ. Попробуйте ещё раз.',
    email_not_confirmed: 'Почта ещё не подтверждена. Откройте письмо и нажмите ссылку.',
    user_banned: 'Аккаунт заблокирован',
  };
  return map[code] || authMessage(err);
};

export const authMessage = err => {
  const m = String(err?.message || err || '');
  return (MESSAGES.find(([re]) => re.test(m)) || [, 'Что-то пошло не так. Попробуйте ещё раз.'])[1];
};
