import { describe, it, expect } from 'vitest';
import { createVault, unlockWithPin, changePin, addBio, unlockWithBio, seal, unseal, isSealed, weakPin, randomBytes } from './vault.js';

const ITER = 1000; // в тестах быстро, в приложении — PIN_ITER
const state = { v: 3, tx: [{ id: 'a', amount: 2500, note: 'Такси' }], settings: { theme: 'dark' } };

describe('шифрование данных на устройстве', () => {
  it('зашифрованное не содержит исходного текста и расшифровывается обратно', async () => {
    const { dek } = await createVault('482915', ITER);
    const rec = await seal(dek, state);
    expect(isSealed(rec)).toBe(true);
    expect(new TextDecoder().decode(rec.ct)).not.toContain('Такси');
    expect(await unseal(dek, rec)).toEqual(state);
  });
  it('верный код открывает данные, неверный — нет', async () => {
    const { dek, meta } = await createVault('482915', ITER);
    const rec = await seal(dek, state);
    expect(await unlockWithPin(meta, '000001')).toBeNull();
    const key = await unlockWithPin(meta, '482915');
    expect(await unseal(key, rec)).toEqual(state);
  });
  it('после смены кода старый не подходит, а данные те же', async () => {
    const { dek, meta } = await createVault('482915', ITER);
    const rec = await seal(dek, state);
    const next = await changePin(meta, dek, '730264');
    expect(await unlockWithPin(next, '482915')).toBeNull();
    expect(await unseal(await unlockWithPin(next, '730264'), rec)).toEqual(state);
  });
  it('биометрия открывает те же данные своим секретом', async () => {
    const { dek, meta } = await createVault('482915', ITER);
    const rec = await seal(dek, state);
    const secret = randomBytes(32);
    const withBio = await addBio(meta, dek, { credId: randomBytes(16), salt: randomBytes(32), secret });
    expect(await unseal(await unlockWithBio(withBio, secret), rec)).toEqual(state);
    await expect(unlockWithBio(withBio, randomBytes(32))).rejects.toThrow();
  });
  it('незашифрованные данные распознаются', () => {
    expect(isSealed(state)).toBe(false);
    expect(isSealed(null)).toBe(false);
  });
  it('простые коды не принимаем', () => {
    ['000000', '111111', '123456', '654321', '345678'].forEach(p => expect(weakPin(p)).toBe(true));
    ['482915', '730264', '112358'].forEach(p => expect(weakPin(p)).toBe(false));
  });
});
