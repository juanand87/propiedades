"use client";

import { Disc3, Music2, Radio, CassetteTape } from "lucide-react";

interface MusicPreloaderProps {
  title?: string;
  storeName?: string;
  message?: string;
  className?: string;
}

export default function MusicPreloader({
  title = "Cargando Tienda",
  storeName = "MundoBeat.cl",
  message = "Preparando el ritmo...",
  className = "",
}: MusicPreloaderProps) {
  return (
    <div className={`min-h-[360px] w-full flex items-center justify-center px-4 py-12 ${className}`}>
      <div className="relative flex flex-col items-center text-center">
        <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,var(--color-primary,#0b83b8)_0%,transparent_62%)] opacity-10 blur-2xl" />

        <div className="relative h-28 w-28 sm:h-32 sm:w-32">
          <div className="absolute inset-0 rounded-full border border-[var(--color-primary,#0b83b8)]/15 bg-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur" />
          <div className="music-preloader-vinyl absolute inset-3 rounded-full bg-[repeating-radial-gradient(circle,#111827_0_4px,#1f2937_5px_8px,#0f172a_9px_13px)] shadow-inner">
            <div className="absolute inset-[28%] rounded-full bg-[conic-gradient(from_90deg,var(--color-primary,#0b83b8),var(--color-secondary,#8b5cf6),var(--color-primary,#0b83b8))]" />
            <div className="absolute inset-[40%] rounded-full bg-white shadow-inner" />
            <div className="absolute left-1/2 top-[10%] h-[38%] w-1 -translate-x-1/2 rounded-full bg-white/20" />
          </div>
          <Disc3 className="absolute -right-2 top-4 h-7 w-7 text-[var(--color-secondary,#8b5cf6)] opacity-80" />
          <CassetteTape className="absolute -left-3 bottom-5 h-7 w-7 text-[var(--color-primary,#0b83b8)] opacity-80" />
        </div>

        <div className="mt-5 flex h-8 items-end gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
            <span
              key={bar}
              className="music-preloader-bar block w-1.5 rounded-full bg-[var(--color-primary,#0b83b8)]"
              style={{ animationDelay: `${bar * 90}ms` }}
            />
          ))}
        </div>

        <div className="relative mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary,#0b83b8)]">
          <Music2 className="h-4 w-4" />
          <span>{title}</span>
          <Radio className="h-4 w-4" />
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{storeName}</p>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
      </div>

      <style jsx global>{`
        .music-preloader-vinyl {
          animation: music-preloader-spin 1.8s linear infinite;
          transform-origin: center;
          will-change: transform;
        }

        .music-preloader-bar {
          height: 10px;
          animation: music-preloader-wave 900ms ease-in-out infinite;
        }

        @keyframes music-preloader-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes music-preloader-wave {
          0%,
          100% {
            height: 8px;
            opacity: 0.55;
          }
          50% {
            height: 30px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
