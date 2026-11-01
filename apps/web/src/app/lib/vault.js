// Шифрование данных на устройстве.
// Данные шифрует случайный ключ (AES-GCM 256). Сам ключ хранится только в зашифрованном виде:
// одна копия — ключом из код-пароля (PBKDF2), другая — ключом от Face ID / Touch ID (WebAuthn PRF).
// Без кода или биометрии прочитать записи из IndexedDB нельзя.
const te = new TextEncoder(), td = new TextDecoder();
const AES = { name: 'AES-GCM', length: 256 };
export const PIN_ITER = 310_000;

export const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));

async function kekFromPin(pin, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, AES, false, ['wrapKey', 'unwrapKey']);
}
async function kekFromSecret(secret) {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('grosh-vault-v1') }, base, AES, false, ['wrapKey', 'unwrapKey']);
}
async function wrap(dek, kek) {
  const iv = randomBytes(12);
  return { iv, ct: new Uint8Array(await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv })) };
}
// ключ данных остаётся извлекаемым: без этого не перешифровать его новым кодом или биометрией
const unwrap = (w, kek) => crypto.subtle.unwrapKey('raw', w.ct, kek, { name: 'AES-GCM', iv: w.iv }, AES, true, ['encrypt', 'decrypt', 'wrapKey']);

/** Новое хранилище: ключ данных и его копия под код-паролем. */
export async function createVault(pin, iter = PIN_ITER) {
  const dek = await crypto.subtle.generateKey(AES, true, ['encrypt', 'decrypt', 'wrapKey']);
  const salt = randomBytes(16);
  return { dek, meta: { v: 1, iter, salt, pin: await wrap(dek, await kekFromPin(pin, salt, iter)), bio: null } };
}

/** Ключ данных по коду; null — код неверный. */
export async function unlockWithPin(meta, pin) {
  try { return await unwrap(meta.pin, await kekFromPin(pin, meta.salt, meta.iter)); } catch (e) { return null; }
}

/** Новый код-пароль для того же ключа данных. */
export async function changePin(meta, dek, pin) {
  const salt = randomBytes(16);
  return { ...meta, salt, pin: await wrap(dek, await kekFromPin(pin, salt, meta.iter)) };
}

/** Копия ключа данных под секретом от биометрии (выход PRF). */
export async function addBio(meta, dek, { credId, salt, secret }) {
  return { ...meta, bio: { credId, salt, key: await wrap(dek, await kekFromSecret(secret)) } };
}
export const unlockWithBio = async (meta, secret) => unwrap(meta.bio.key, await kekFromSecret(secret));

export const isSealed = rec => !!rec && rec.enc === 1 && rec.ct instanceof Uint8Array;

export async function seal(dek, value) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, te.encode(JSON.stringify(value)));
  return { enc: 1, iv, ct: new Uint8Array(ct) };
}
export async function unseal(dek, rec) {
  return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, dek, rec.ct)));
}

/** Слишком простой код: одна цифра или подряд по возрастанию/убыванию. */
export const weakPin = pin => /^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);
