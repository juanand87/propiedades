"use client";

import { useEffect, useState } from "react";

export interface ResolvedThemeColors {
  primary: string;
  secondary: string;
  action: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

const FALLBACK: ResolvedThemeColors = {
  primary: "#9333ea",
  secondary: "#2563eb",
  action: "#9333ea",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#475569",
  border: "#dbe3ee",
};

function luminance(color: string) {
  const value = color.trim().replace("#", "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return 1;
  const hex = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function readTheme(): ResolvedThemeColors {
  if (typeof window === "undefined") return FALLBACK;
  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue("--color-primary").trim() || FALLBACK.primary;
  const secondary = styles.getPropertyValue("--color-secondary").trim() || FALLBACK.secondary;
  const accent = styles.getPropertyValue("--color-accent").trim() || primary;
  const surface = styles.getPropertyValue("--color-bg-page").trim() || FALLBACK.surface;
  const dark = luminance(surface) < 0.35;
  const action = contrast(primary, surface) >= 2.5 ? primary : contrast(accent, surface) >= 2.5 ? accent : dark ? "#ffffff" : "#0f172a";
  return {
    primary,
    secondary,
    action,
    surface,
    text: dark ? "#f8fafc" : "#0f172a",
    muted: dark ? "#cbd5e1" : "#475569",
    border: dark ? "#475569" : "#dbe3ee",
  };
}

export function useResolvedThemeColors() {
  const [colors, setColors] = useState<ResolvedThemeColors>(FALLBACK);

  useEffect(() => {
    const update = () => setColors(readTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
