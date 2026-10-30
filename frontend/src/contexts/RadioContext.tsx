"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

const RADIO_URL = "https://a9.asurahosting.com/listen/mundo_beat/radio.mp3";

// Audio singleton — vive a nivel de módulo para sobrevivir la navegación
let globalAudio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement {
  if (!globalAudio && typeof window !== "undefined") {
    globalAudio = new Audio();
    globalAudio.preload = "none";
    globalAudio.volume = 0.8;
  }
  return globalAudio!;
}

interface RadioContextType {
  playing: boolean;
  loading: boolean;
  volume: number;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  stop: () => void;
}

const RadioContext = createContext<RadioContextType | null>(null);

export function RadioProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const audio = getAudio();
    const onPlaying = () => { setPlaying(true);  setLoading(false); };
    const onPause   = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onCanplay = () => setLoading(false);
    const onError   = () => { setLoading(false); setPlaying(false); };

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause",   onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanplay);
    audio.addEventListener("error",   onError);

    // Sync initial state if audio was already playing from a previous mount
    setPlaying(!audio.paused && audio.currentTime > 0);

    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause",   onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanplay);
      audio.removeEventListener("error",   onError);
    };
  }, []);

  const togglePlay = () => {
    const audio = getAudio();
    if (!audio.paused) {
      audio.pause();
    } else {
      setLoading(true);
      audio.src = RADIO_URL;
      audio.load();
      audio.play().catch(() => setLoading(false));
    }
  };

  const setVolume = (v: number) => {
    setVolumeState(v);
    getAudio().volume = v;
  };

  const stop = () => {
    const audio = getAudio();
    audio.pause();
    audio.src = "";
    setPlaying(false);
    setIsOpen(false);
  };

  return (
    <RadioContext.Provider value={{ playing, loading, volume, isOpen, setIsOpen, togglePlay, setVolume, stop }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio must be used inside RadioProvider");
  return ctx;
}
