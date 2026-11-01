import { useState, useEffect } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';

// Обновления приложения. Сервис-воркер хранит все файлы приложения в Cache Storage, поэтому Грош открывается офлайн.
// Когда на сервере новая версия, он скачивает её в фоне и ждёт: по кнопке «Обновить» новая версия включается,
// старый кеш удаляется, страница перезагружается. Данные в IndexedDB при этом не трогаются.
const HOUR = 60 * 60 * 1000;

export const pwa = { ready: false, dismissed: false, subs: new Set(), apply: null };
const emit = () => pwa.subs.forEach(f => f());

export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  const update = registerSW({
    onNeedRefresh() { pwa.ready = true; pwa.dismissed = false; emit(); },
    onRegisteredSW(url, reg) {
      if (!reg) return;
      // проверяем раз в час и каждый раз, когда возвращаются в приложение
      const check = () => { if (navigator.onLine !== false && !reg.installing) reg.update().catch(() => {}); };
      setInterval(check, HOUR);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    },
  });
  pwa.apply = () => update(true);
}

export function usePwa() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); pwa.subs.add(f); return () => pwa.subs.delete(f); }, []);
  return pwa;
}
