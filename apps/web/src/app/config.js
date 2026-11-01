// Конфигурация приложения. Значения из .env (VITE_*) встраиваются при сборке.
const env = import.meta.env;

export const config = {
  appName: 'Грош',
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  // publishable (sb_publishable_…) или старый anon key — оба публичные, их можно держать во фронтенде
  supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '',
  // OAuth-клиент «Грош Web» в Google Cloud — публичный идентификатор, не секрет
  googleClientId: env.VITE_GOOGLE_CLIENT_ID || '354565607214-bt5ei6ib6ed0sd0fnd9ltlkm9sef598u.apps.googleusercontent.com',
  syncIntervalMs: 60_000,
  pushDebounceMs: 1_500,
};

/** Подключён ли сервер. Без ключей приложение работает только на устройстве. */
export const cloudEnabled = () => !!(config.supabaseUrl && config.supabaseKey);

/** Куда вернуться после письма (подтверждение почты, сброс пароля, вход через Google). */
export const redirectUrl = () => (typeof location === 'undefined' ? '' : location.origin + location.pathname);
