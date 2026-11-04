"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fixed canvas widths make preview layout independent of the editor viewport. */
export function DesignPreview({
  mode,
  children,
  focusFooter = false,
  focusHeader = false,
}: {
  mode: "desktop" | "mobile";
  children: ReactNode;
  focusFooter?: boolean;
  focusHeader?: boolean;
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
  useEffect(() => {
    if (focusHeader && stage.current) stage.current.scrollTop = 0;
    else if (focusFooter && stage.current)
      stage.current.scrollTop = stage.current.scrollHeight;
  }, [focusFooter, focusHeader, size.height, size.width, mode]);
  const scale = size.width ? Math.min(1, size.width / width) : 0;
  useEffect(() => {
    if (scale && canvas.current && stage.current)
      canvas.current.style.setProperty(
        "--preview-scroll-top",
        `${stage.current.scrollTop / scale}px`,
      );
  }, [scale]);
  return (
    <div
      className="design-preview-stage"
      ref={stage}
      role="region"
      aria-label="Vista previa interactiva del sitio"
      tabIndex={0}
      onScroll={(e) => {
        if (scale)
          canvas.current?.style.setProperty(
            "--preview-scroll-top",
            `${e.currentTarget.scrollTop / scale}px`,
          );
      }}
    >
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
