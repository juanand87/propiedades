import { useColorScheme } from "react-native";
const night: Record<string, string> = {
  "#fff": "#06132e",
  "#ffffff": "#06132e",
  "#fbfcff": "#06132e",
  "#f5f7ff": "#040f2b",
  "#071c55": "#f4f8ff",
  "#10376b": "#f4f8ff",
  "#123b70": "#e2eeff",
  "#08275f": "#e2eeff",
  "#49658b": "#b5c8e3",
  "#315a87": "#b5c8e3",
  "#304a70": "#b5c8e3",
  "#edf4ff": "#15264a",
  "#edf6ff": "#15264a",
  "#dcecff": "#183458",
  "#d3e0f2": "#294266",
  "#e0e8f2": "#294266",
  "#a5c1e1": "#406089",
  "#0866f5": "#00bde9",
  "#ffffffee": "#15264a",
  "#1c568b": "#b5d5f8",
};
export function useNightStyles<T extends Record<string, object>>(styles: T): T {
  const dark = useColorScheme() === "dark";
  if (!dark) return styles;
  return Object.fromEntries(
    Object.entries(styles).map(([key, value]) => [
      key,
      Object.fromEntries(
        Object.entries(value).map(([property, color]) => [
          property,
          property === "color" && (color === "#fff" || color === "#ffffff")
            ? color
            : typeof color === "string" && /color$/i.test(property)
            ? night[color.toLowerCase()] || color
            : color,
        ]),
      ),
    ]),
  ) as T;
}
