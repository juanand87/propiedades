"use client";

import { useState, useEffect, useRef } from "react";

interface RotatingPhrasesProps {
  phrases: string[];
  rotationSpeed?: number;
  scrollSpeed?: number;
  bgColor?: string;
  textColor?: string;
}

export default function RotatingPhrases({
  phrases,
  rotationSpeed = 10000,
  scrollSpeed = 50,
  bgColor,
  textColor = "#ffffff",
}: RotatingPhrasesProps) {
  // Comenzar con una frase aleatoria
  const [currentIndex, setCurrentIndex] = useState(() => 
    Math.floor(Math.random() * (phrases?.length || 1))
  );
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!phrases || phrases.length === 0) return;

    // Rotar frases
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length);
    }, rotationSpeed);

    return () => clearInterval(interval);
  }, [phrases, rotationSpeed]);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;

    const container = containerRef.current;
    const text = textRef.current;

    // Verificar si el texto es más largo que el contenedor
    if (text.scrollWidth > container.clientWidth) {
      setIsScrolling(true);
    } else {
      setIsScrolling(false);
    }
  }, [currentIndex, phrases]);

  if (!phrases || phrases.length === 0) return null;

  const currentPhrase = phrases[currentIndex] || "";
  
  // Si no se especifica bgColor, usar el gradiente del tema
  const useThemeGradient = !bgColor || bgColor === "#8B5CF6";

  return (
    <div
      ref={containerRef}
      className={`w-full text-sm overflow-hidden ${useThemeGradient ? 'theme-gradient-bg' : ''}`}
      style={!useThemeGradient ? {
        backgroundColor: bgColor,
        color: textColor,
      } : {
        color: textColor,
      }}
    >
      <div className="max-w-[1300px] mx-auto px-4 py-2">
        <p
          ref={textRef}
          className={`whitespace-nowrap ${isScrolling ? "animate-scroll" : "text-center"}`}
          style={{
            animation: isScrolling
              ? `scroll ${Math.max(currentPhrase.length / 10, 10)}s linear infinite`
              : "none",
          }}
        >
          {currentPhrase}
        </p>
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}
