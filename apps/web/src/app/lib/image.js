// Фото профиля: квадрат из середины снимка, JPEG ~30 КБ. Хранится в Supabase Storage (бакет avatars,
// папка пользователя), в профиле — только ссылка. Без сервера — прямо в профиле как data URL.
import { supabase } from './supabase.js';

const SIZE = 384, BUCKET = 'avatars';

/** Файл с телефона или компьютера → сжатый квадратный JPEG. */
export async function photoFromFile(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('not-image');
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => { throw new Error('unsupported'); });
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  img.close?.();
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

const toDataUrl = blob => new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
// путь файла в нашем бакете по публичной ссылке; чужие ссылки (например, фото из Google) не трогаем
const pathOf = url => url?.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/)?.[1] || null;

/** Загружает фото и возвращает ссылку на него. Прежнее фото удаляется. */
export async function uploadPhoto(blob, prev) {
  const session = supabase && (await supabase.auth.getSession()).data.session;
  if (!session) return toDataUrl(blob);
  // случайное имя: ссылку не угадать, а новое фото не застрянет в кеше браузера под старым адресом
  const path = `${session.user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  removePhoto(prev);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function removePhoto(url) {
  const path = pathOf(url);
  if (path && supabase) supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}

export function photoMessage(e) {
  const m = String(e?.message || '');
  if (m === 'unsupported') return 'Этот формат не открывается. Выберите JPEG или PNG.';
  if (m === 'not-image') return 'Это не похоже на фото. Выберите картинку.';
  if (/bucket not found/i.test(m)) return 'Хранилище фото ещё не настроено на сервере';
  if (/fetch|network/i.test(m)) return 'Нет соединения — фото не загрузилось';
  return 'Не удалось загрузить фото. Попробуйте ещё раз.';
}

/** Фото из Google в хорошем размере вместо миниатюры 96 px. */
export const googlePhoto = url => (url ? url.replace(/=s\d+(-c)?$/, '=s256-c') : null);
