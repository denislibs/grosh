import { useState, useEffect, useRef } from 'preact/hooks';
import { runtime, useConfig } from './config.js';

const systemReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Нужно ли упрощать движение: настройка ConfigProvider или системная. */
export const isReducedMotion = (config = runtime.config) => config.motion === 'reduced' || (config.motion !== 'full' && systemReduced());
export const useReducedMotion = () => isReducedMotion(useConfig());

/** Плавный пересчёт числа к новому значению (баланс, суммы в итогах). */
export function useCountUp(target, { duration = 800, fromZero = false } = {}) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(fromZero ? 0 : target);
  const prev = useRef(fromZero ? 0 : target);
  useEffect(() => {
    const from = prev.current, to = target;
    prev.current = to;
    if (from === to || reduced) { setV(to); return; }
    let raf, t0;
    const step = t => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / duration);
      setV(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
