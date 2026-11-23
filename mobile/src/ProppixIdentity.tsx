import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
export function ProppixMark({
  size = 52,
  light = false,
}: {
  size?: number;
  light?: boolean;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityLabel="Logo Proppix"
    >
      <Path
        d="M14 87V29Q14 12 32 12H57Q86 12 86 41Q86 69 57 69H33V87Q33 94 24 94H22Q14 94 14 87Z"
        fill={light ? "#fff" : "#071c55"}
      />
      <Rect
        x="33"
        y="27"
        width="14"
        height="14"
        rx="3.5"
        fill={light ? "#071c55" : "#fff"}
      />
      <Rect x="51" y="27" width="14" height="14" rx="3.5" fill="#05b9e7" />
      <Rect
        x="33"
        y="45"
        width="14"
        height="14"
        rx="3.5"
        fill={light ? "#071c55" : "#fff"}
      />
      <Rect
        x="51"
        y="45"
        width="14"
        height="14"
        rx="3.5"
        fill={light ? "#071c55" : "#fff"}
      />
    </Svg>
  );
}
export function ProppixBrand({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <View
      accessibilityLabel="Proppix"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 1 : 2,
      }}
    >
      <ProppixMark size={compact ? 41 : 55} light={light} />
      <Text
        style={{
          color: light ? "#fff" : "#071c55",
          fontWeight: "800",
          fontSize: compact ? 30 : 40,
          letterSpacing: -1.6,
        }}
      >
        ropp<Text style={{ color: "#05b9e7" }}>i</Text>x
      </Text>
    </View>
  );
}
