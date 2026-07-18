import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";

// Drives the marquee's position by hand (translateX in px, via requestAnimationFrame)
// instead of a CSS animation, so a finger/mouse drag can grab it mid-scroll and the
// auto-scroll can resume smoothly from wherever it was left — a CSS keyframe animation
// can't be nudged like that without a visual snap.
export function useDraggableMarquee(itemCount: number) {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const halfWidthRef = useRef(0);
  const draggingRef = useRef(false);
  const pausedRef = useRef(false);
  const lastXRef = useRef(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || itemCount === 0) return;
    halfWidthRef.current = el.scrollWidth / 2;
  }, [itemCount]);

  useEffect(() => {
    if (itemCount === 0) return;
    const SPEED = 36; // px/s
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!draggingRef.current && !pausedRef.current) {
        offsetRef.current -= SPEED * dt;
      }
      const half = halfWidthRef.current;
      if (half > 0) {
        if (offsetRef.current <= -half) offsetRef.current += half;
        if (offsetRef.current > 0) offsetRef.current -= half;
      }
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${offsetRef.current}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [itemCount]);

  const dragHandlers = {
    onPointerDown: (ev: PointerEvent) => {
      draggingRef.current = true;
      lastXRef.current = ev.clientX;
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    },
    onPointerMove: (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      offsetRef.current += ev.clientX - lastXRef.current;
      lastXRef.current = ev.clientX;
    },
    onPointerUp: () => {
      draggingRef.current = false;
    },
    onPointerCancel: () => {
      draggingRef.current = false;
    },
    // Pause-on-hover only makes sense for an actual mouse — a touch tap
    // fires a synthetic "mouseenter" with no matching "mouseleave" behind
    // it (there's no real pointer to move away), which left the marquee
    // paused for good after a single tap. Gating on pointerType keeps
    // that behavior mouse-only; a tap or drag on touch never touches
    // pausedRef at all.
    onPointerEnter: (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") pausedRef.current = true;
    },
    onPointerLeave: (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") {
        pausedRef.current = false;
        draggingRef.current = false;
      }
    },
  };

  return { trackRef, dragHandlers };
}
