// Face ID / Touch ID для разблокировки: отдельный ключ доступа «Разблокировка Гроша» с расширением PRF.
// По каждому подтверждению биометрии устройство выдаёт один и тот же секрет — из него получается ключ хранилища.
import { randomBytes } from './vault.js';

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
/** Как называть биометрию на этом устройстве. */
export const bio = /iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ? { name: 'Face ID', by: 'по Face ID', icon: 'face' }
  : /Macintosh/.test(ua) ? { name: 'Touch ID', by: 'по Touch ID', icon: 'fingerprint' }
  : /Windows/.test(ua) ? { name: 'Windows Hello', by: 'через Windows Hello', icon: 'fingerprint' }
  : /Android/.test(ua) ? { name: 'Биометрия', by: 'по отпечатку или лицу', icon: 'fingerprint' }
  : { name: 'Биометрия', by: 'по биометрии', icon: 'fingerprint' };

/** Есть ли на устройстве биометрия, которая умеет PRF. */
export async function bioSupported() {
  const P = typeof window !== 'undefined' && window.PublicKeyCredential;
  if (!P) return false;
  try {
    const caps = await P.getClientCapabilities?.();
    if (caps && 'extension:prf' in caps && !caps['extension:prf']) return false;
  } catch (e) { /* старые браузеры без getClientCapabilities — проверим при включении */ }
  return !!(await P.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false));
}

const prfOf = cred => cred.getClientExtensionResults()?.prf;

/** Секрет от биометрии для уже созданного ключа. */
export async function bioSecret(credId, salt) {
  const a = await navigator.credentials.get({ publicKey: {
    challenge: randomBytes(32), timeout: 60_000, userVerification: 'required',
    allowCredentials: [{ type: 'public-key', id: credId }],
    extensions: { prf: { eval: { first: salt } } },
  } });
  const out = prfOf(a)?.results?.first;
  if (!out) throw new Error('prf-unsupported');
  return new Uint8Array(out);
}

/** Создаёт ключ разблокировки → { credId, salt, secret }. */
export async function bioCreate() {
  const salt = randomBytes(32);
  const cred = await navigator.credentials.create({ publicKey: {
    rp: { name: 'Грош' },
    user: { id: randomBytes(16), name: 'Разблокировка Гроша', displayName: 'Разблокировка Гроша' },
    challenge: randomBytes(32), timeout: 60_000,
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    extensions: { prf: { eval: { first: salt } } },
  } });
  const prf = prfOf(cred);
  if (!prf?.enabled) throw new Error('prf-unsupported');
  const credId = new Uint8Array(cred.rawId);
  // часть браузеров выдаёт секрет сразу, остальным нужно ещё одно подтверждение
  const secret = prf.results?.first ? new Uint8Array(prf.results.first) : await bioSecret(credId, salt);
  return { credId, salt, secret };
}

/** Текст ошибки; null — человек сам отменил. */
export function bioMessage(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') return null;
  if (e?.message === 'prf-unsupported') return `Этот браузер не умеет открывать Грош ${bio.by}. Используйте код-пароль.`;
  if (e?.name === 'InvalidStateError') return 'Ключ разблокировки уже есть на этом устройстве';
  return `Не получилось открыть ${bio.by}. Введите код-пароль.`;
}
