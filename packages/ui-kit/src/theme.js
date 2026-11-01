import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useState, useRef } from 'preact/hooks';
import { html } from 'htm/preact';

const ThemeContext = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} });
const dark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * Тема: 'system' | 'light' | 'dark'. Вешает data-theme на <html> (или на target),
 * следит за системной темой, обновляет <meta name="theme-color">.
 * tokens — переопределение CSS-переменных: { tint: '#5856D6' } → --tint.
 * Управляемый режим: передайте theme и onChange; без них провайдер хранит тему сам.
 */
export function ThemeProvider({ theme: controlled, defaultTheme = 'system', onChange, tokens, target, children }) {
  const [own, setOwn] = useState(defaultTheme);
  const theme = controlled ?? own;
  const [sysDark, setSysDark] = useState(dark);
  // атрибут, который мог поставить хост (например, окно предпросмотра) — возвращаем его в режиме system
  const hostAttr = useRef(typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSysDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved = theme === 'system' ? (hostAttr.current || (sysDark ? 'dark' : 'light')) : theme;

  useEffect(() => {
    const el = target || document.documentElement;
    if (theme === 'system') { hostAttr.current ? el.setAttribute('data-theme', hostAttr.current) : el.removeAttribute('data-theme'); }
    else el.setAttribute('data-theme', theme);
    const bg = getComputedStyle(el).getPropertyValue('--bg').trim();
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    if (bg) meta.content = bg;
  }, [theme, resolved, target]);

  useEffect(() => {
    if (!tokens) return;
    const el = target || document.documentElement;
    const keys = Object.keys(tokens);
    keys.forEach(k => el.style.setProperty('--' + k, tokens[k]));
    return () => keys.forEach(k => el.style.removeProperty('--' + k));
  }, [tokens && JSON.stringify(tokens), target]);

  const value = useMemo(() => ({
    theme, resolved,
    setTheme: t => { if (controlled === undefined) setOwn(t); onChange && onChange(t); },
  }), [theme, resolved, controlled, onChange]);
  return html`<${ThemeContext.Provider} value=${value}>${children}<//>`;
}

export const useTheme = () => useContext(ThemeContext);
