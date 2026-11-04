"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** A zero-height frame preserves the floating cover while keeping it in the scroll flow. */
export function SiteHeaderFrame({
  sticky,
  shrink,
  children,
}: {
  sticky?: boolean;
  shrink?: boolean;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!sticky || !shrink || !frame.current) return;
    const el = frame.current;
    const stage = el.closest<HTMLElement>(".design-preview-stage");
    const canvas = el.closest<HTMLElement>(".design-preview-canvas");
    const target = stage ?? window;
    const onScroll = () => {
      const scale = canvas
        ? canvas.getBoundingClientRect().width / canvas.offsetWidth
        : 1;
      const scroll = stage ? stage.scrollTop / (scale || 1) : window.scrollY;
      // Different enter/leave thresholds avoid flicker when the layout changes.
      setCompact((previous) => (previous ? scroll > 32 : scroll > 96));
    };
    const header = el.firstElementChild as HTMLElement;
    const measure = () => {
      if (!el.classList.contains("is-compact"))
        el.style.setProperty(
          "--header-frame-height",
          `${header.offsetHeight}px`,
        );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      target.removeEventListener("scroll", onScroll);
    };
  }, [sticky, shrink]);
  return sticky ? (
    <div
      ref={frame}
      className={`sticky-header-wrap${shrink ? " shrink-enabled" : ""}${shrink && compact ? " is-compact" : ""}`}
    >
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
