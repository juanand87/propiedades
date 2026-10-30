"use client";

import { useRadio } from "@/contexts/RadioContext";
import { useState, useRef, useEffect } from "react";

export default function RadioFloatingPlayer() {
  const { playing, loading, volume, isOpen, setIsOpen, togglePlay, setVolume, stop } = useRadio();

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Desktop drag state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const playerRef = useRef<HTMLDivElement>(null);

  // Position desktop top-left on first open
  useEffect(() => {
    if (isOpen && pos.x === 0 && pos.y === 0 && typeof window !== "undefined") {
      setPos({ x: 0, y: 1 });
    }
  }, [isOpen]);

  const startDrag = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      let newX = dragStart.current.px + dx;
      let newY = dragStart.current.py + dy;
      const w = playerRef.current?.offsetWidth || 320;
      const h = playerRef.current?.offsetHeight || 36;
      newX = Math.max(0, Math.min(window.innerWidth - w, newX));
      newY = Math.max(0, Math.min(window.innerHeight - h, newY));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  if (!isOpen) return null;

  /* ─────────── MOBILE: barra fija en la parte inferior ─────────── */
  if (isMobile) {
    return (
      <>
        <div
          style={{ zIndex: 9999 }}
          className="fixed bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-red-600 to-purple-700 shadow-[0_-2px_12px_rgba(0,0,0,0.25)]"
        >
          {/* Punto parpadeante */}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${playing ? "bg-white animate-pulse" : "bg-white/40"}`} />

          {/* Nombre */}
          <span className="text-white font-bold text-xs tracking-wide select-none whitespace-nowrap">Radio Beat</span>

          {/* Ecualizador */}
          <span className="flex items-end gap-[2px] h-4 flex-shrink-0">
            {[0.5, 0.8, 0.5, 0.7, 0.6].map((delay, i) => (
              <span
                key={i}
                className={`w-[3px] rounded-full ${playing ? "bg-white" : "bg-white/30"}`}
                style={{
                  height: playing ? `${[8, 14, 10, 14, 8][i]}px` : "5px",
                  animation: playing ? `radioWave 0.5s ease-in-out ${delay}s infinite alternate` : "none",
                  transition: "height 0.3s",
                }}
              />
            ))}
          </span>

          <span className="flex-1" />

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            disabled={loading}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 active:bg-white/40 text-white flex items-center justify-center transition-colors"
            title={playing ? "Pausar" : "Reproducir"}
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Volumen */}
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="w-20 accent-white h-1 cursor-pointer flex-shrink-0"
            title="Volumen"
          />

          {/* Cerrar */}
          <button
            onClick={stop}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 active:bg-red-500 text-white flex items-center justify-center text-[11px] transition-colors"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Espaciador para que el contenido no quede tapado */}
        <div className="h-12" />

        <style>{`
          @keyframes radioWave {
            from { transform: scaleY(0.3); }
            to   { transform: scaleY(1); }
          }
        `}</style>
      </>
    );
  }

  /* ─────────── DESKTOP: barra flotante arrastrable ─────────── */
  return (
    <>
      <div
        ref={playerRef}
        onMouseDown={startDrag}
        style={{ left: pos.x, top: pos.y, zIndex: 9999, userSelect: "none", width: 320 }}
        className="fixed flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-600 to-purple-700 shadow-lg rounded-sm cursor-grab active:cursor-grabbing"
        title="Arrastrar reproductor"
      >
        {/* Punto parpadeante */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${playing ? "bg-white animate-pulse" : "bg-white/40"}`} />

        {/* Nombre */}
        <span className="text-white font-bold text-xs tracking-wide select-none whitespace-nowrap">Radio Beat</span>

        {/* Ecualizador */}
        <span className="flex items-end gap-[2px] h-4 flex-shrink-0">
          {[0.5, 0.8, 0.5, 0.7, 0.6].map((delay, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full ${playing ? "bg-white" : "bg-white/30"}`}
              style={{
                height: playing ? `${[8, 14, 10, 14, 8][i]}px` : "5px",
                animation: playing ? `radioWave 0.5s ease-in-out ${delay}s infinite alternate` : "none",
                transition: "height 0.3s",
              }}
            />
          ))}
        </span>

        <span className="flex-1" />

        {/* Play / Pause */}
        <button
          onClick={e => { e.stopPropagation(); togglePlay(); }}
          onMouseDown={e => e.stopPropagation()}
          disabled={loading}
          className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
          title={playing ? "Pausar" : "Reproducir"}
        >
          {loading ? (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Volumen */}
        <input
          type="range" min={0} max={1} step={0.02} value={volume}
          onChange={e => setVolume(Number(e.target.value))}
          onMouseDown={e => e.stopPropagation()}
          className="w-16 accent-white h-1 cursor-pointer flex-shrink-0"
          title="Volumen"
        />

        {/* Cerrar */}
        <button
          onClick={e => { e.stopPropagation(); stop(); }}
          onMouseDown={e => e.stopPropagation()}
          className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 hover:bg-red-500 text-white flex items-center justify-center text-[10px] transition-colors ml-0.5"
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes radioWave {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </>
  );
}
