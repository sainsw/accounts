'use client';

import { useLayoutEffect, useRef } from 'react';

export const useReorderAnimation = () => {
  const elementsRef = useRef(new Map<string, HTMLElement>());
  const positionsRef = useRef(new Map<string, number>());
  const armedRef = useRef(false);

  useLayoutEffect(() => {
    const newPositions = new Map<string, number>();
    elementsRef.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      newPositions.set(id, rect.top);
    });

    if (armedRef.current) {
      const oldPositions = positionsRef.current;
      newPositions.forEach((newTop, id) => {
        const oldTop = oldPositions.get(id);
        if (oldTop == null) return;
        const dy = oldTop - newTop;
        if (Math.abs(dy) < 1) return;
        const el = elementsRef.current.get(id);
        if (!el || typeof el.animate !== 'function') return;
        el.getAnimations?.()
          .filter((a) => (a.effect as KeyframeEffect | null)?.getKeyframes().some((k) => 'transform' in k))
          .forEach((a) => a.cancel());
        el.animate(
          [
            { transform: `translate3d(0, ${dy}px, 0)` },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          { duration: 220, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        );
      });
      armedRef.current = false;
    }

    positionsRef.current = newPositions;
  });

  const arm = () => {
    armedRef.current = true;
  };

  const registerRef = (id: string) => (el: HTMLElement | null) => {
    if (el) elementsRef.current.set(id, el);
    else elementsRef.current.delete(id);
  };

  return { arm, registerRef };
};
