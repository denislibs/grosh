# Грош

PWA учёта трат в тенге: категории, челленджи, рассрочки, депозиты (ГЭСВ ↔ номинальная), календарь, статистика, 26 наград, «Итоги месяца». Работает офлайн, синхронизируется через Supabase.

```
packages/ui-kit/      @grosh/ui-kit — iOS-нативный UI-kit (отдельная библиотека)
apps/web/             приложение (Vite + Preact + htm + vite-plugin-pwa)
  src/app/lib/        расчёты: даты, финансы, награды, демо-данные, Supabase
  src/app/state/      хранилище (IndexedDB), синхронизация, контекст приложения
  src/app/screens/    экраны: Обзор, Календарь, Статистика, Награды, Настройки, Профиль, Вход
  src/app/sheets/     шторки: запись, рассрочка, депозит, челлендж, категория, бэкап…
  src/app/overlays/   «Итоги месяца», новая награда
supabase/migrations/  схема базы и правила доступа (RLS)
design/               исходный прототип и витрина дизайн-системы
scripts/icons.mjs     собирает список иконок для шрифта Material Symbols
```

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # тесты расчётов
npm run build      # kit + приложение в apps/web/dist
npm run icons      # после добавления новых иконок в код
```

## CI/CD

`.github/workflows/ci.yml`:
- **CI** — на каждый pull request и пуш: `npm ci` → `npm test` → `npm run build`.
- **CD** — после успешной проверки `main` сборка выкладывается на GitHub Pages: https://denislibs.github.io/grosh/

Настройки репозитория:
- Settings → Pages → Source: **GitHub Actions**.
- Settings → Secrets and variables → Actions → **Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (публичные значения, не секреты).
- Подпапку `/grosh/` задаёт переменная `BASE` в workflow — Vite и PWA-манифест берут её оттуда.

## Supabase

1. **Ключи.** `apps/web/.env`: `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys → Publishable key). Secret/service_role ключ во фронтенд не кладём никогда. Без ключей приложение работает только на устройстве.
2. **База.** SQL Editor → New query → вставить `supabase/migrations/0001_init.sql` → Run. Создаст таблицы и правила: каждый видит только свои строки.
3. **Адреса для писем и входа.** Authentication → URL Configuration: Site URL — `https://denislibs.github.io/grosh/`; в Redirect URLs — он же и `http://localhost:5173`.
4. **Google / Apple** (по желанию). Authentication → Sign In / Providers. Google — бесплатно, ключи из Google Cloud Console. Apple — нужен аккаунт Apple Developer.

## Как устроены данные

- Всё пишется в IndexedDB, приложение полностью работает офлайн.
- Синхронизация (`state/sync.js`): изменённые записи сами попадают в очередь и отправляются upsert'ом; с сервера забирается только изменённое после последнего раза. Из двух версий записи побеждает более свежая. Удаление — мягкое (`deleted_at`), чтобы доходило до всех устройств.
- Платёж по рассрочке создаётся сам в день оплаты; его id выводится из id рассрочки, поэтому два устройства не создадут дубль.
- Депозит: проценты по дням от номинальной ставки с ежемесячной капитализацией; ГЭСВ = (1 + ном/12)^12 − 1.
