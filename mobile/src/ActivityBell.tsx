import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ProppixIcon } from "./ProppixIcon";
export function ActivityBell({ unread = 0 }: { unread?: number }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Actividad${unread ? `, ${unread} sin leer` : ""}`}
      onPress={() => router.push("/actividad")}
      style={s.button}
    >
      <ProppixIcon name="bell" size={25} />
      {unread > 0 && (
        <View style={s.badge}>
          <Text style={s.text}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  button: { padding: 9 },
  badge: {
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: "#e83c62",
    borderRadius: 12,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
