"use client";

import { useRadio } from "@/contexts/RadioContext";

interface RadioPlayerButtonProps {
  buttonClass?: string;
  iconOnly?: boolean;
}

export default function RadioPlayerButton({ buttonClass = "text-gray-700 hover:text-purple-600", iconOnly = false }: RadioPlayerButtonProps) {
  const { playing, togglePlay, setIsOpen } = useRadio();

  const handleClick = () => {
    setIsOpen(true);
    togglePlay();
  };

  if (iconOnly) {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all text-xs font-semibold ${
          playing
            ? "bg-red-600 text-white"
            : buttonClass
        }`}
        title="Radio Beat"
      >
        {/* Icono parlante */}
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <span>Radio Beat</span>
        {playing && (
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse flex-shrink-0" />
        )}
        <style>{`@keyframes radioBeat{from{transform:scaleY(0.4)}to{transform:scaleY(1)}}`}</style>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-sm font-semibold ${
        playing
          ? "bg-red-600 border-red-600 text-white shadow-md shadow-red-400/40"
          : `border-current ${buttonClass}`
      }`}
      title="Radio Beat"
    >
      <span className="flex items-end gap-[2px] h-4">
        {[10, 16, 10].map((h, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full transition-all ${playing ? "bg-white" : "bg-current"}`}
            style={{
              height: playing ? `${h}px` : "8px",
              animation: playing ? `radioBeat ${[0.6, 0.4, 0.7][i]}s ease-in-out infinite alternate` : "none",
            }}
          />
        ))}
      </span>
      <span>Radio Beat</span>
      <style>{`@keyframes radioBeat{from{transform:scaleY(0.4)}to{transform:scaleY(1)}}`}</style>
    </button>
  );
}

