# @grosh/ui-kit

iOS-нативный UI-kit для веба на Preact + htm. Системные цвета и шрифты, inset-grouped списки, без теней и градиентов. Светлая и тёмная тема, планшетная раскладка через container query.

```js
import { ConfigProvider, ThemeProvider, Screen, Section, Select, DatePicker } from '@grosh/ui-kit';
import '@grosh/ui-kit/styles.css';
```

Зависимости-«пиры»: `preact@^10`, `htm@^3`. Иконки — Material Symbols Rounded (подключите шрифт с нужными `icon_names`).

## Провайдеры

```js
<ConfigProvider haptics motion="system" locale="ru-RU" labels=${{ cancel: 'Отмена' }}>
  <ThemeProvider theme=${settings.theme} onChange=${setTheme} tokens=${{ tint: '#5856D6' }}>
    <App />
  </ThemeProvider>
</ConfigProvider>
```

| | Что задаёт | Хук |
|---|---|---|
| `ConfigProvider` | вибрация `haptics`, движение `motion: 'system' \| 'full' \| 'reduced'`, `locale`, `currency`, подписи кнопок `labels`. Вложенные провайдеры сливаются с родителем. | `useConfig()`, `useLabels()` |
| `ThemeProvider` | тема `system \| light \| dark` (управляемая через `theme`/`onChange` или своя через `defaultTheme`), атрибут `data-theme`, `<meta name="theme-color">`, переопределение токенов `tokens` | `useTheme()` → `{ theme, resolved, setTheme }` |

Вне компонентов: `haptic(pattern)`, `isReducedMotion()`.

## Компоненты

| Группа | Компоненты |
|---|---|
| Примитивы | `Icon`, `Sq` (глиф на цветном квадрате), `Chevron`, `Tag`, `Count`, `Avatar`, `Spinner`, `Progress`, `Ring`, `Badge` (награда с кольцом) |
| Ввод | `Field` (иконка, очистка, пароль, ошибка), `SearchField`, `Seg`, `Switch`, `Check`, `Stepper`, `Capsule`, `Slider` |
| Выбор (свои, не нативные) | `Select`, `Menu`, `DatePicker`, `Calendar`, `TimePicker`, `Wheel`, `Popover` |
| Раскладка | `Screen` (большой заголовок → навбар), `Page` (push-экран), `Section` |
| Слои | `Sheet` + `SheetNav`, `Dialog` (алерт и action sheet), `Island` (уведомление) |
| Обратная связь | `Banner`, `Empty`, `Confetti` |
| Хуки | `useCountUp`, `useReducedMotion` |

`Popover` рендерится в `<body>` через портал: его не обрезают группы со скруглением, он сам выбирает сторону (вниз или вверх), закрывается по клику снаружи и Esc. На нём построены `Select`, `Menu`, `DatePicker`, `TimePicker`.

## Правила

- Глубина — фоном (`--bg` → `--bg-2` → `--fill-3`) и линией `0.5px var(--sep)`. Без теней, градиентов, эмодзи.
- Цвет только через токены и со смыслом: `--tint` действие, `--green` доход, `--red` расход и удаление, `--orange` награды.
- Без «зума» на выборе и вводе: выбор — контур или галочка, нажатие — подсветка фона.
- Каркас приложения: `.app { position: fixed; inset: 0 }` — контейнер `app` для container query (≥ 900px → сайдбар и окна вместо шторок).

## Сборка

`npm run build -w @grosh/ui-kit` → `dist/ui-kit.js` (ESM, preact и htm внешние). В монорепо приложение берёт исходники напрямую.
