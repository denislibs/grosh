import { html } from 'htm/preact';
import { createPortal } from 'preact/compat';
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'preact/hooks';
import { useConfig, useLabels } from '../config.js';
import { haptic } from '../haptics.js';
import { Icon } from './primitives.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Всплывающая панель у элемента-якоря. Рендерится в <body> (портал), поэтому её не обрезают
 * группы со скруглением и overflow: hidden. Сама выбирает сторону: вниз или вверх.
 * align: 'end' — правым краем к якорю, 'start' — левым.
 */
export function Popover({ anchor, open, onClose, align = 'end', minWidth, label, children }) {
  const ref = useRef();
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return; }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => { setMounted(false); setClosing(false); setPos(null); }, 180);
    return () => clearTimeout(t);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect(), el = ref.current;
      if (!a || !el) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      const left = clamp(align === 'end' ? a.right - w : align === 'center' ? a.left + (a.width - w) / 2 : a.left, 8, innerWidth - w - 8);
      let top = a.bottom + 6, up = false;
      if (top + h > innerHeight - 8 && a.top - h - 6 > 8) { top = a.top - h - 6; up = true; }
      top = clamp(top, 8, Math.max(8, innerHeight - h - 8));
      setPos({ left, top, origin: `${align === 'end' ? 'right' : 'left'} ${up ? 'bottom' : 'top'}` });
    };
    place();
    const outside = e => { if (!ref.current?.contains(e.target) && !anchor.current?.contains(e.target)) onClose(); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); anchor.current?.focus(); } };
    addEventListener('resize', place); addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside, true); addEventListener('keydown', key, true);
    return () => { removeEventListener('resize', place); removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', outside, true); removeEventListener('keydown', key, true); };
  }, [open, mounted]);

  if (!mounted || typeof document === 'undefined') return null;
  const style = pos ? `left:${pos.left}px;top:${pos.top}px;transform-origin:${pos.origin};${minWidth ? 'min-width:' + minWidth + 'px' : ''}`
    : `left:0;top:0;visibility:hidden;${minWidth ? 'min-width:' + minWidth + 'px' : ''}`;
  return createPortal(html`<div class=${'menu popover' + (closing ? ' is-closing' : '') + (pos ? ' is-placed' : '')} ref=${ref} style=${style} role="dialog" aria-label=${label}>${children}</div>`, document.body);
}

// стрелки ↑↓, Home/End по пунктам списка внутри панели
const useListKeys = (open, ref) => useEffect(() => {
  if (!open) return;
  const el = () => ref.current?.querySelectorAll('[data-item]') || [];
  const t = setTimeout(() => { const items = [...el()]; (items.find(i => i.getAttribute('aria-checked') === 'true') || items[0])?.focus(); }, 30);
  const key = e => {
    const items = [...el()]; if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const go = n => { e.preventDefault(); items[(n + items.length) % items.length].focus(); };
    if (e.key === 'ArrowDown') go(i + 1); else if (e.key === 'ArrowUp') go(i - 1); else if (e.key === 'Home') go(0); else if (e.key === 'End') go(items.length - 1);
  };
  addEventListener('keydown', key);
  return () => { clearTimeout(t); removeEventListener('keydown', key); };
}, [open]);

/**
 * Выпадающий список вместо нативного <select>.
 * options: [[value, label, icon?], …]
 */
export function Select({ id, value, options, onChange, label, tint, block, placeholder = '—' }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(), list = useRef();
  useListKeys(open, list);
  const cur = options.find(o => String(o[0]) === String(value));
  const pick = v => { haptic(4); setOpen(false); if (String(v) !== String(value)) onChange(v); btn.current?.focus(); };
  return html`<span class=${'select' + (tint ? ' select--tint' : '') + (block ? ' select--block' : '')}>
    <button ref=${btn} id=${id} type="button" class="select__btn" aria-haspopup="listbox" aria-expanded=${String(open)} aria-label=${label ? `${label}: ${cur ? cur[1] : placeholder}` : undefined}
      onClick=${() => { haptic(4); setOpen(!open); }}>
      <span class="select__value">${cur ? cur[1] : placeholder}</span><${Icon} n="unfold_more" />
    </button>
    <${Popover} anchor=${btn} open=${open} onClose=${() => setOpen(false)} align=${block ? 'start' : 'end'} label=${label}>
      <div role="listbox" aria-label=${label} ref=${list}>
        ${options.map(([v, l, icon]) => {
          const on = String(v) === String(value);
          return html`<button type="button" class="menu__item" data-item role="option" aria-selected=${String(on)} aria-checked=${String(on)} onClick=${() => pick(v)}>
            <span class="ms menu__tick">check</span><span>${l}</span>${icon && html`<${Icon} n=${icon} />`}
          </button>`;
        })}
      </div>
    <//>
  </span>`;
}

/**
 * Меню действий (pull-down). children — содержимое кнопки-триггера.
 * items: [{ label, icon, destructive, checked, onSelect } | 'gap']
 */
export function Menu({ items, title, label, align = 'end', triggerClass = 'circle-btn circle-btn--tint', children }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(), list = useRef();
  useListKeys(open, list);
  const checkable = items.some(i => i && i.checked !== undefined);
  return html`<span class="menu-anchor">
    <button ref=${btn} type="button" class=${triggerClass} aria-haspopup="menu" aria-expanded=${String(open)} aria-label=${label} onClick=${() => { haptic(4); setOpen(!open); }}>${children}</button>
    <${Popover} anchor=${btn} open=${open} onClose=${() => setOpen(false)} align=${align} minWidth=${240} label=${label}>
      ${title && html`<div class="menu__title">${title}</div>`}
      <div role="menu" ref=${list}>
        ${items.map((it, i) => it === 'gap' ? html`<div class="menu__gap" key=${'g' + i}></div>` : html`<button type="button" data-item key=${it.label}
          class=${'menu__item' + (it.destructive ? ' menu__item--destructive' : '')} role=${checkable ? 'menuitemradio' : 'menuitem'} aria-checked=${checkable ? String(!!it.checked) : undefined}
          onClick=${() => { haptic(4); setOpen(false); it.onSelect && it.onSelect(); }}>
          ${checkable && html`<span class="ms menu__tick">check</span>`}<span>${it.label}</span>${it.icon && html`<${Icon} n=${it.icon} />`}
        </button>`)}
      </div>
    <//>
  </span>`;
}

/* ---------- даты ---------- */
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };

/** Календарь месяца в стиле iOS: сегодня красным, выбранный день залит. */
export function Calendar({ value, onChange, min, max, weekStart = 1 }) {
  const { locale } = useConfig();
  const t = useLabels();
  const today = toISO(new Date());
  const init = value ? fromISO(value) : new Date();
  const [ym, setYm] = useState(init.getFullYear() * 12 + init.getMonth());
  const [dir, setDir] = useState(0);
  const y = Math.floor(ym / 12), m = ym % 12;
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m, 1)).replace(/\s?г\.$/, '');
  const wds = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { weekday: 'short' }); return [...Array(7)].map((_, i) => f.format(new Date(2024, 0, 7 + ((i + weekStart) % 7)))); }, [locale, weekStart]);
  const lead = (new Date(y, m, 1).getDay() - weekStart + 7) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const go = d => { haptic(4); setDir(d); setYm(v => v + d); };
  const off = d => (min && d < min) || (max && d > max);
  return html`<div class="datepicker">
    <div class="datepicker__head">
      <b>${title}</b>
      <button type="button" class="btn btn--plain" aria-label="Предыдущий месяц" onClick=${() => go(-1)}><${Icon} n="chevron_left" /></button>
      <button type="button" class="btn btn--plain" aria-label="Следующий месяц" onClick=${() => go(1)}><${Icon} n="chevron_right" /></button>
    </div>
    <div class=${'cal' + (dir > 0 ? ' cal--l' : dir < 0 ? ' cal--r' : '')} key=${ym}>
      ${wds.map(w => html`<div class="cal__wd">${w}</div>`)}
      ${[...Array(lead)].map(() => html`<div class="day day--out"></div>`)}
      ${[...Array(dim)].map((_, i) => {
        const d = toISO(new Date(y, m, i + 1)), dis = off(d);
        return html`<button type="button" class=${'day' + (d === today ? ' day--today' : '') + (d === value ? ' day--sel' : '') + (dis ? ' day--future' : '')}
          disabled=${dis} aria-pressed=${String(d === value)} aria-label=${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(new Date(y, m, i + 1))}
          onClick=${() => { haptic(5); onChange(d); }}><span class="day__n">${i + 1}</span></button>`;
      })}
    </div>
    <div class="datepicker__foot">
      <button type="button" class="btn btn--plain" disabled=${off(today)} onClick=${() => { const n = new Date(); setYm(n.getFullYear() * 12 + n.getMonth()); onChange(today); }}>Сегодня</button>
    </div>
  </div>`;
}

/** Капсула с датой; по нажатию — календарь. value/min/max в формате YYYY-MM-DD. */
export function DatePicker({ id, value, onChange, min, max, weekStart = 1, placeholder = 'Дата', label, pressed, icon = 'calendar_month', format }) {
  const { locale } = useConfig();
  const [open, setOpen] = useState(false);
  const btn = useRef();
  const text = value ? (format ? format(value) : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(fromISO(value)).replace(/\s?г\.$/, '')) : placeholder;
  return html`<span class="menu-anchor">
    <button ref=${btn} id=${id} type="button" class="capsule" aria-pressed=${String(pressed ?? !!value)} aria-haspopup="dialog" aria-expanded=${String(open)} aria-label=${label ? `${label}: ${text}` : undefined}
      onClick=${() => { haptic(4); setOpen(!open); }}>${icon && html`<${Icon} n=${icon} />`}${text}</button>
    <${Popover} anchor=${btn} open=${open} onClose=${() => setOpen(false)} label=${label || placeholder}>
      <${Calendar} value=${value} min=${min} max=${max} weekStart=${weekStart} onChange=${d => { onChange(d); setOpen(false); btn.current?.focus(); }} />
    <//>
  </span>`;
}

/* ---------- барабан и время ---------- */
/** Колонка барабана: прокрутка со щелчком к строке, строки наклоняются в 3D. items: [[value, label], …] */
export function Wheel({ items, value, onChange, label }) {
  const ref = useRef(), raf = useRef(0), settle = useRef(0);
  const idx = Math.max(0, items.findIndex(x => String(x[0]) === String(value)));
  const paint = () => {
    const col = ref.current; if (!col) return;
    const c = col.scrollTop + 90;
    col.querySelectorAll('.wheel__item').forEach(el => {
      const d = (el.offsetTop + 18 - c) / 36;
      el.style.transform = `rotateX(${clamp(-d * 22, -70, 70)}deg)`;
      el.style.opacity = String(Math.max(0.25, 1 - Math.abs(d) * 0.25));
    });
  };
  useLayoutEffect(() => { ref.current.scrollTop = idx * 36; paint(); }, []);
  const onScroll = () => {
    cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(paint);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const i = clamp(Math.round(ref.current.scrollTop / 36), 0, items.length - 1);
      if (String(items[i][0]) !== String(value)) { haptic(3); onChange(items[i][0]); }
    }, 90);
  };
  return html`<div class="wheel__col" ref=${ref} onScroll=${onScroll} role="listbox" aria-label=${label} tabindex="0"
    onKeyDown=${e => { const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0; if (!d) return; e.preventDefault(); const i = clamp(idx + d, 0, items.length - 1); ref.current.scrollTo({ top: i * 36, behavior: 'smooth' }); onChange(items[i][0]); }}>
    <div class="wheel__pad"></div>
    ${items.map(([v, l]) => html`<div class="wheel__item" role="option" aria-selected=${String(String(v) === String(value))}>${l}</div>`)}
    <div class="wheel__pad"></div>
  </div>`;
}

/** Время HH:MM: капсула и барабан часов и минут. */
export function TimePicker({ id, value = '09:00', onChange, step = 5, label }) {
  const t = useLabels();
  const [open, setOpen] = useState(false);
  const btn = useRef();
  const [h, mi] = value.split(':').map(Number);
  const hours = useMemo(() => [...Array(24)].map((_, i) => [i, pad(i)]), []);
  const mins = useMemo(() => [...Array(Math.ceil(60 / step))].map((_, i) => [i * step, pad(i * step)]), [step]);
  const set = (hh, mm) => onChange(`${pad(hh)}:${pad(mm)}`);
  return html`<span class="menu-anchor">
    <button ref=${btn} id=${id} type="button" class="capsule num" aria-haspopup="dialog" aria-expanded=${String(open)} aria-label=${label ? `${label}: ${value}` : undefined} onClick=${() => { haptic(4); setOpen(!open); }}>${value}</button>
    <${Popover} anchor=${btn} open=${open} onClose=${() => setOpen(false)} label=${label}>
      <div class="timepicker">
        <div class="wheel">
          <${Wheel} items=${hours} value=${h} onChange=${v => set(v, mi)} label="Часы" />
          <span class="timepicker__colon">:</span>
          <${Wheel} items=${mins} value=${Math.round(mi / step) * step % 60} onChange=${v => set(h, v)} label="Минуты" />
        </div>
        <button type="button" class="btn btn--plain is-bold" onClick=${() => { setOpen(false); btn.current?.focus(); }}>${t.done}</button>
      </div>
    <//>
  </span>`;
}
