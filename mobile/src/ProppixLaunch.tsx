import { brandColors } from "./brand-colors";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ProppixBrand, ProppixMark } from "./ProppixIdentity";
export function ProppixLaunch({ children }: { children?: React.ReactNode }) {
  return (
    <LinearGradient colors={["#ffffff", "#eff5ff", "#e3f4ff"]} style={s.root}>
      <View style={s.motif} />
      <View style={s.motifSmall} />
      <View style={s.icon}>
        <ProppixMark size={108} />
      </View>
      <ProppixBrand />
      <Text style={s.tagline}>Encuentra el hogar que buscas.</Text>
      <ActivityIndicator color="#05b9e7" style={{ marginTop: 36 }} />
      <Text accessibilityLiveRegion="polite" style={s.status}>
        Preparando tu próximo lugar…
      </Text>
      {children}
      <Text style={s.footer}>PROPIEDADES · PERSONAS · HISTORIAS</Text>
    </LinearGradient>
  );
}
const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  icon: {
    width: 152,
    height: 152,
    borderRadius: 40,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    boxShadow: "0 14px 42px #071c5515",
  },
  tagline: {
    fontSize: 16,
    color: "#536681",
    marginTop: 14,
    textAlign: "center",
  },
  status: { color: brandColors.secondary, fontSize: 13, marginTop: 14 },
  footer: {
    position: "absolute",
    bottom: 38,
    color: "#8393ad",
    fontSize: 9,
    letterSpacing: 2,
  },
  motif: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 60,
    backgroundColor: "#05b9e70d",
    top: -65,
    right: -75,
    transform: [{ rotate: "25deg" }],
  },
  motifSmall: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 45,
    backgroundColor: "#071c5506",
    bottom: 60,
    left: -95,
    transform: [{ rotate: "25deg" }],
  },
});
