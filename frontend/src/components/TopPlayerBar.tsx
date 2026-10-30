"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRadio } from "@/contexts/RadioContext";
import { api } from "@/lib/api";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

interface TopPlayerBarProps {
  config?: any;
  isMarketplace?: boolean;
  secondaryMenuItems?: any[];
  getMenuUrl?: (item: any) => string;
}

export default function TopPlayerBar({ config, isMarketplace, secondaryMenuItems = [], getMenuUrl }: TopPlayerBarProps) {
  const { playing, loading, volume, togglePlay, setVolume, isOpen, setIsOpen, stop } = useRadio();

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Rotating phrases (desktop only)
  const phrases: string[] = config?.topBarPhrases?.phrases?.length > 0
    ? config.topBarPhrases.phrases
    : (config?.headerConfig?.topBarText ? [config.headerConfig.topBarText] : []);
  const rotationSpeed: number = config?.topBarPhrases?.rotationSpeed || 8000;
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    if (!phrases.length || isMobile) return;
    const t = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % phrases.length);
        setFadeIn(true);
      }, 400);
    }, rotationSpeed);
    return () => clearInterval(t);
  }, [phrases.length, rotationSpeed, isMobile]);

  // Currently playing (polling every 5s, con delay de 18s al cambiar canción)
  const STREAM_DELAY_MS = 18000;
  const [nowPlaying, setNowPlaying] = useState<any>(null);
  const cancelledRef = useRef(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  // Siempre guarda la data más reciente de la API (para mostrar inmediato al abrir)
  const latestDataRef = useRef<any>(null);

  useEffect(() => {
    if (!isMarketplace) return;
    cancelledRef.current = false;

    const poll = async () => {
      try {
        const data = await api.getCurrentlyPlayingPublic(MARKETPLACE_VENDOR_ID);
        if (cancelledRef.current) return;

        latestDataRef.current = data;

        const newTrackId = data?.trackId || data?.trackName || null;
        const isSameTrack = newTrackId && newTrackId === currentTrackIdRef.current;
        const isFirstLoad = currentTrackIdRef.current === null;

        if (isSameTrack) {
          // Misma canción: actualizar info sin delay
          setNowPlaying(data);
        } else if (isFirstLoad) {
          // Primera carga (entrada a página): mostrar inmediatamente, sin delay
          currentTrackIdRef.current = newTrackId;
          setNowPlaying(data);
        } else {
          // Canción nueva mientras ya se estaba reproduciendo: delay 18s (desfase del stream)
          currentTrackIdRef.current = newTrackId;
          if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
          delayTimerRef.current = setTimeout(() => {
            if (!cancelledRef.current) {
              setNowPlaying(data);
            }
          }, STREAM_DELAY_MS);
        }
      } catch {
        if (!cancelledRef.current) setNowPlaying(null);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, [isMarketplace]);

  // Al abrir la barra en mobile: mostrar la canción más reciente de inmediato
  useEffect(() => {
    if (isOpen && latestDataRef.current) {
      setNowPlaying(latestDataRef.current);
    }
  }, [isOpen]);

  // Format label for "Puedes comprar este ___"
  const formatLabel = nowPlaying?.linkedProduct?.format || null;
  const productLabel = formatLabel ? `este ${formatLabel}` : "este disco";

  const topBarEnabled =
    config?.headerConfig?.topBarEnabled !== false &&
    config?.topBarEnabled !== false;
  const configuredText = config?.headerConfig?.topBarText || config?.topBarText || "";
  const visiblePhrases = topBarEnabled ? phrases : [];
  const hasTextContent = topBarEnabled && (isMarketplace ? visiblePhrases.length > 0 : !!configuredText);
  const hasSecondaryMenu = secondaryMenuItems.length > 0 && !!getMenuUrl;

  /* ─── Vendor store: simple text bar (no radio player) ─── */
  if (!isMarketplace) {
    if (!hasTextContent && !hasSecondaryMenu) return null;
    return (
      <div className="w-full theme-gradient-bg text-white text-sm">
        <div className="max-w-[1300px] mx-auto px-4 py-2 flex items-center justify-between gap-6 min-h-[36px]">
          {hasTextContent && <span className="min-w-0 truncate">{configuredText}</span>}
          {hasSecondaryMenu && (
            <nav className={`${hasTextContent ? "ml-auto" : "w-full justify-end"} flex items-center gap-5 overflow-x-auto`} aria-label="Menú secundario">
              {secondaryMenuItems.map((item: any) => (
                <Link key={item.id || `${item.label}-${item.customUrl || ""}`} href={getMenuUrl!(item)} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noopener noreferrer" : undefined} className="whitespace-nowrap text-xs font-medium text-white/90 hover:text-white hover:underline">
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    );
  }

  if (!hasTextContent && !hasSecondaryMenu) return null;

  const hasNowPlaying = !!(nowPlaying?.playing && nowPlaying?.linkedProduct);

  /* ─── Controls row (shared between mobile/desktop) ─── */
  const controlsRow = (
    <div className="flex items-center gap-2.5 flex-shrink-0">
      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        disabled={loading}
        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors flex-shrink-0"
        title={playing ? "Pausar radio" : "Reproducir radio"}
      >
        {loading ? (
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

      {/* Name */}
      <span className="font-bold text-sm tracking-wide whitespace-nowrap">Radio Beat</span>

      {/* Equalizer */}
      <span className="flex items-end gap-[2px] h-4 flex-shrink-0">
        {[10, 14, 10, 14, 8].map((h, i) => (
          <span
            key={i}
            className={`w-[2px] rounded-full ${playing ? "bg-white" : "bg-white/40"}`}
            style={{
              height: playing ? `${h}px` : "5px",
              animation: playing ? `topBarWave 0.6s ease-in-out ${i * 0.1}s infinite alternate` : "none",
              transition: "height 0.3s",
            }}
          />
        ))}
      </span>

      {/* Volume */}
      <input
        type="range" min={0} max={1} step={0.05} value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-16 accent-white h-1 cursor-pointer flex-shrink-0"
        title="Volumen"
      />
    </div>
  );

  /* ─── "Está sonando" row ─── */
  const productUrl = hasNowPlaying
    ? `http://localhost:3000/productos/${nowPlaying?.linkedProduct?.id}`
    : null;

  const nowPlayingRow = hasNowPlaying ? (
    <div className="flex items-start gap-1.5 min-w-0">
      {/* mini waveform */}
      <span className="flex items-end gap-[2px] h-3 flex-shrink-0 mt-0.5">
        {[8, 12, 8].map((h, i) => (
          <span
            key={i}
            className="w-[2px] bg-white rounded-full"
            style={{
              height: `${h}px`,
              animation: `topBarWave 0.5s ease-in-out ${i * 0.15}s infinite alternate`,
            }}
          />
        ))}
      </span>
      <span className="text-xs leading-tight min-w-0">
        <span className="opacity-80">Está sonando </span>
        <Link
          href={productUrl!}
          className="font-semibold hover:underline transition-opacity"
        >
          &ldquo;{nowPlaying.trackName}&rdquo;
        </Link>
        <span className="opacity-80"> — Puedes comprar {productLabel} </span>
        <Link
          href={productUrl!}
          className="underline font-bold hover:opacity-80 transition-opacity"
        >
          acá
        </Link>
      </span>
    </div>
  ) : null;

  /* ─── MOBILE layout: fixed bottom bar, shown only when isOpen ─── */
  if (isMobile) {
    if (!isOpen) return null;
    return (
      <div
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9990 }}
        className="theme-gradient-bg text-white shadow-[0_-2px_12px_rgba(0,0,0,0.25)]"
      >
        {/* Row 1: controls + close */}
        <div className="px-4 pt-3 pb-1 flex items-center gap-3">
          <div className="flex items-center gap-2.5 flex-1">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              disabled={loading}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors flex-shrink-0"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

            {/* Name + Equalizer */}
            <span className="font-bold text-sm tracking-wide whitespace-nowrap">Radio Beat</span>
            <span className="flex items-end gap-[2px] h-4 flex-shrink-0">
              {[10, 14, 10, 14, 8].map((h, i) => (
                <span
                  key={i}
                  className={`w-[2px] rounded-full ${playing ? "bg-white" : "bg-white/40"}`}
                  style={{
                    height: playing ? `${h}px` : "5px",
                    animation: playing ? `topBarWave 0.6s ease-in-out ${i * 0.1}s infinite alternate` : "none",
                    transition: "height 0.3s",
                  }}
                />
              ))}
            </span>

            {/* Volume */}
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 accent-white h-1 cursor-pointer"
            />
          </div>

          {/* Close */}
          <button
            onClick={() => stop()}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-red-500 flex items-center justify-center text-xs transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Row 2: está sonando */}
        {hasNowPlaying && (
          <div className="px-4 pb-3">
            {nowPlayingRow}
          </div>
        )}

        <style>{`
          @keyframes topBarWave {
            from { transform: scaleY(0.4); }
            to   { transform: scaleY(1); }
          }
        `}</style>
      </div>
    );
  }

  /* ─── DESKTOP layout: single row ─── */
  return (
    <div className="w-full theme-gradient-bg text-white text-sm">
      <div className="max-w-[1300px] mx-auto px-4 py-2.5 flex items-center gap-3 min-h-[42px]">

        {topBarEnabled && controlsRow}

        {/* Separador */}
        {topBarEnabled && <span className="w-px h-4 bg-white/30 flex-shrink-0" />}

        {/* Está sonando */}
        {topBarEnabled && hasNowPlaying ? (
          <div className="flex-1 min-w-0 truncate">
            {nowPlayingRow}
          </div>
        ) : (
          <span className="flex-1" />
        )}

        {/* Phrases (desktop only) */}
        {visiblePhrases.length > 0 && (
          <>
            <span className="w-px h-4 bg-white/30 flex-shrink-0" />
            <div className="max-w-xs truncate text-right flex-shrink-0 lg:mr-[200px]">
              <span
                className="text-white/90 text-xs italic transition-opacity duration-500"
                style={{ opacity: fadeIn ? 1 : 0 }}
              >
                {visiblePhrases[phraseIndex]}
              </span>
            </div>
          </>
        )}

        {hasSecondaryMenu && (
          <>
            {(topBarEnabled || visiblePhrases.length > 0) && <span className="w-px h-4 bg-white/30 flex-shrink-0" />}
            <nav className="flex items-center gap-4 overflow-x-auto flex-shrink-0" aria-label="Menú secundario">
              {secondaryMenuItems.map((item: any) => (
                <Link key={item.id || `${item.label}-${item.customUrl || ""}`} href={getMenuUrl!(item)} target={item.openInNewTab ? "_blank" : undefined} rel={item.openInNewTab ? "noopener noreferrer" : undefined} className="whitespace-nowrap text-xs font-medium text-white/90 hover:text-white hover:underline">
                  {item.label}
                </Link>
              ))}
            </nav>
          </>
        )}
      </div>

      <style>{`
        @keyframes topBarWave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
