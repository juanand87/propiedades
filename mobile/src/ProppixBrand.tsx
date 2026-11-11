import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

export function ProppixBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessibilityLabel="Proppix Propiedades"
      style={{ width: compact ? 132 : 200 }}
    >
      <Svg
        width={compact ? 90 : 134}
        height={compact ? 24 : 38}
        viewBox="0 0 134 38"
        style={{ marginLeft: compact ? 22 : 34 }}
      >
        <Path
          d="M3 35 67 3l64 32"
          fill="none"
          stroke="#fff"
          strokeWidth={2.4}
        />
        <Circle cx={114} cy={32} r={3.5} fill="#fff" />
      </Svg>
      <Text style={[styles.word, compact && { fontSize: 31, marginTop: -7 }]}>
        Proppix<Text style={{ color: "#29c8ed" }}>.</Text>
      </Text>
      {!compact && (
        <View style={styles.subtitle}>
          <View style={styles.line} />
          <Text style={styles.caption}>PROPIEDADES</Text>
          <View style={styles.line} />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  word: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1.7,
    marginTop: -9,
  },
  subtitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 4,
  },
  line: { width: 18, height: 1, backgroundColor: "#fff" },
  caption: {
    color: "#fff",
    letterSpacing: 3.4,
    fontSize: 9,
    fontWeight: "700",
  },
});
