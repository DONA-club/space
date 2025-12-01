"use client";

import { useEffect, useState } from 'react';
import { useSpring } from 'framer-motion';

interface Options {
  stiffness?: number;
  damping?: number;
  enabled?: boolean;
}

/**
 * Lisse une valeur numérique avec une animation de type ressort.
 * - value: nombre à lisser (ou null/undefined pour désactiver)
 * - options: réglages du ressort et activation
 */
export function useSmoothedValue(
  value: number | null | undefined,
  options?: Options
): number | null {
  const { stiffness = 200, damping = 24, enabled = true } = options || {};
  const [current, setCurrent] = useState<number | null>(value ?? null);
  const spring = useSpring(value ?? 0, { stiffness, damping });

  useEffect(() => {
    if (value == null) {
      setCurrent(null);
      return;
    }

    if (!enabled) {
      setCurrent(value);
      spring.set(value);
      return;
    }

    spring.set(value);
    const unsubscribe = spring.on("change", (v) => setCurrent(v));
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [value, enabled, spring]);

  return current;
}