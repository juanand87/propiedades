"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fixed canvas widths make preview layout independent of the editor viewport. */
export function DesignPreview({
  mode,
  children,
}: {
  mode: "desktop" | "mobile";
  children: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = mode === "desktop" ? 1120 : 390;
  useEffect(() => {
    if (!stage.current || !canvas.current) return;
    const measure = () =>
      setSize({
        width: stage.current!.clientWidth,
        height: canvas.current!.offsetHeight,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(stage.current);
    observer.observe(canvas.current);
    measure();
    return () => observer.disconnect();
  }, []);
  const scale = size.width ? Math.min(1, size.width / width) : 0;
  return (
    <div className="design-preview-stage" ref={stage}>
      <div
        className="design-preview-scaled-space"
        style={{ height: size.height * scale }}
      >
        <div
          ref={canvas}
          className="design-preview-canvas"
          data-device={mode}
          style={{ width, transform: `translateX(-50%) scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
