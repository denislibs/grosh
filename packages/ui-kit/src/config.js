import { createContext } from 'preact';
import { useContext, useMemo, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';

// Подписи системных кнопок и состояний. Приложение может переопределить любую.
export const defaultLabels = {
  cancel: 'Отмена',
  done: 'Готово',
  close: 'Закрыть',
  back: 'Назад',
  clear: 'Очистить',
  loading: 'Загрузка',
  showPassword: 'Показать пароль',
  hidePassword: 'Скрыть пароль',
  search: 'Поиск',
  decrease: 'Меньше',
  increase: 'Больше',
};

export const defaultConfig = {
  haptics: true,          // короткая вибрация на нажатиях (Android)
  motion: 'system',       // 'system' | 'full' | 'reduced'
  locale: 'ru-RU',
  currency: '₸',
  labels: defaultLabels,
};

// Императивный доступ для кода вне компонентов (например, haptic() в обработчике данных).
export const runtime = { config: defaultConfig };

const ConfigContext = createContext(defaultConfig);

/**
 * Настройки kit'а. Вложенные провайдеры сливаются с родительским.
 * <ConfigProvider haptics={false} motion="reduced" labels={{ cancel: 'Отменить' }}>…</ConfigProvider>
 */
export function ConfigProvider({ children, labels, ...rest }) {
  const parent = useContext(ConfigContext);
  const value = useMemo(() => ({
    ...parent,
    ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
    labels: { ...parent.labels, ...labels },
  }), [parent, labels, rest.haptics, rest.motion, rest.locale, rest.currency]);
  runtime.config = value;
  useEffect(() => {
    const root = document.documentElement;
    if (value.motion === 'reduced') root.setAttribute('data-motion', 'reduced');
    else if (value.motion === 'full') root.setAttribute('data-motion', 'full');
    else root.removeAttribute('data-motion');
  }, [value.motion]);
  return html`<${ConfigContext.Provider} value=${value}>${children}<//>`;
}

export const useConfig = () => useContext(ConfigContext);
export const useLabels = () => useContext(ConfigContext).labels;
