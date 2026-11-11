import Svg, { Path, Circle, Rect } from "react-native-svg";

export type ProppixIconName =
  | "home"
  | "search"
  | "bell"
  | "filters"
  | "house"
  | "building"
  | "land"
  | "handshake"
  | "heart"
  | "pin"
  | "bed"
  | "bath"
  | "area"
  | "arrow"
  | "plus"
  | "messages"
  | "comment"
  | "share"
  | "bookmark"
  | "check"
  | "refresh"
  | "profile"
  | "menu"
  | "close"
  | "play"
  | "send";

const paths: Partial<Record<ProppixIconName, string>> = {
  play: "M8 4 21 12 8 20Z",
  send: "M22 2 9 15M22 2l-8 20-5-7-7-5Z",
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  house: "M2 11 12 3l10 8M5 9v12h14V9M10 21v-7h4v7M3 21h18",
  search: "m16.5 16.5 5 5",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4M12 2v2",
  filters: "M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12",
  building:
    "M3 21h18M5 21V8h7v13M12 21V3h7v18M8 11v1m0 3v1m7-10v1m0 3v1m0 3v1m0 3v3",
  land: "m12 2-6 8h3l-5 7h6v5h4v-5h6l-5-7h3Z",
  handshake:
    "m2 8 4-4 4 2h4l4-2 4 4-4 9-4 3-8-4Zm5-2-2 5m12-5 3 5M10 6l-3 5 2 2 4-3 5 5m-9 0 5 4",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  pin: "M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z",
  bed: "M3 18V7m18 11V9M3 15h18M3 10h18v8M7 10V7h4v3m2 0V7h4v3",
  bath: "M3 12h18l-2 7H6ZM6 12V5a2 2 0 0 1 4 0M7 21v-2m10 2v-2M8 7h4",
  area: "M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6M7 17 17 7m-5 0h5v5",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  plus: "M12 4v16M4 12h16",
  messages: "M21 11a9 9 0 0 1-9 9H5l-3 2 1-6a9 9 0 1 1 18-5Z",
  comment:
    "M22 10.5C22 5.8 17.5 2 12 2S2 5.8 2 10.5 6.5 19 12 19h1l6 3-1-5c2.5-1.5 4-3.6 4-6.5Z",
  share: "m22 8-9-7v5C5 6 2 11 2 21c3-6 7-8 11-8v5Z",
  bookmark: "M5 3h14v19l-7-5-7 5Z",
  check: "m4 12 5 5L20 6",
  refresh:
    "M20 7V2m0 5h-5M4 17v5m0-5h5M5 7a8 8 0 0 1 13-2l2 2M4 17l2 2a8 8 0 0 0 13-2",
  profile: "M3 22v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2Z",
  menu: "M3 5h18M3 12h18M3 19h18",
  close: "m6 6 12 12M6 18 18 6",
};

export function ProppixIcon({
  name,
  size = 24,
  color = "#fff",
  filled = false,
}: {
  name: ProppixIconName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={paths[name]} fill={filled ? color : "none"} />
      {name === "search" && <Circle cx={10} cy={10} r={7} />}
      {name === "pin" && <Circle cx={12} cy={10} r={2} />}
      {name === "profile" && <Circle cx={12} cy={6} r={4} />}
      {name === "messages" && (
        <>
          <Circle cx={8} cy={11} r={0.6} fill={color} />
          <Circle cx={12} cy={11} r={0.6} fill={color} />
          <Circle cx={16} cy={11} r={0.6} fill={color} />
        </>
      )}
      {name === "comment" && (
        <>
          {[6, 10, 14, 18].map((x) => (
            <Circle
              key={x}
              cx={x}
              cy={10.5}
              r={1}
              fill="#17334c"
              stroke="none"
            />
          ))}
        </>
      )}
      {name === "filters" && (
        <>
          <Rect x={9} y={4} width={4} height={4} rx={1} />
          <Rect x={15} y={10} width={4} height={4} rx={1} />
          <Rect x={5} y={16} width={4} height={4} rx={1} />
        </>
      )}
    </Svg>
  );
}
