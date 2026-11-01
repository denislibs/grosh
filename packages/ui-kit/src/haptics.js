import { runtime } from './config.js';

/** Короткая вибрация (Android). Уважает ConfigProvider haptics={false}. */
export function haptic(pattern = 8) {
  try {
    if (runtime.config.haptics && navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* вибрация недоступна — молча пропускаем */ }
}
