"use client";
import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const first = useRef(true);
  useEffect(() => {
    const start = first.current ? target * 0.92 : from.current;
    first.current = false;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      const x = start + (target - start) * e;
      setV(x);
      from.current = x;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function useLiveRate(base = "SGD", quote = "KZT", everyMs = 3000) {
  const [r, setR] = useState<{ rate: number; prev: number; avg: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch(`/api/rates?base=${base}&quote=${quote}&live=1`)
        .then((x) => x.json())
        .then((j) => alive && setR((old) => ({ rate: j.live, prev: old?.rate ?? j.live, avg: j.avg })))
        .catch(() => {});
    tick();
    const id = setInterval(tick, everyMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [base, quote, everyMs]);
  return r;
}

export function vibrate(ms: number | number[] = 20) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
