import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, Session } from "./api";
import { ProppixIcon } from "./ProppixIcon";
import { notifyModerationChange } from "./moderation-events";
const reasons = [
  ["spam", "Spam o publicidad engañosa"],
  ["scam", "Estafa o información falsa"],
  ["harassment", "Acoso o amenazas"],
  ["inappropriate", "Contenido inapropiado"],
  ["privacy", "Privacidad o datos personales"],
  ["other", "Otro motivo"],
];
export function ModerationActions({
  kind,
  targetId,
  authorId,
  session,
  color = "#0866f5",
  label = "Reportar",
}: {
  kind: "user" | "video" | "comment";
  targetId: string;
  authorId?: string;
  session: Session | null;
  color?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState("spam"),
    [details, setDetails] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function begin() {
    if (!session) {
      Alert.alert(
        "Inicia sesión",
        "Entra a tu cuenta para reportar o bloquear.",
        [
          { text: "Cancelar" },
          { text: "Iniciar sesión", onPress: () => router.push("/cuenta") },
        ],
      );
      return;
    }
    setError("");
    setDetails("");
    setOpen(true);
  }
  async function report() {
    if (busy || !session) return;
    setBusy(true);
    setError("");
    try {
      await api("/reports", {
        method: "POST",
        token: session.access_token,
        body: { kind, target_id: targetId, reason, details },
      });
      setOpen(false);
      Alert.alert(
        "Reporte recibido",
        "El equipo de Proppix lo revisará. Reportar no retira el contenido automáticamente.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setBusy(false);
    }
  }
  async function block() {
    if (!session || !authorId || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/me/blocks/${authorId}`, {
        method: "POST",
        token: session.access_token,
        body: { active: true },
      });
      setOpen(false);
      notifyModerationChange({ userId: authorId, blocked: true });
      router.replace("/");
      Alert.alert(
        "Usuario bloqueado",
        "Puedes desbloquearlo desde el menú → Usuarios bloqueados.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo bloquear.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={begin}
        style={s.trigger}
      >
        <ProppixIcon name="flag" size={18} color={color} />
        <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <SafeAreaView style={s.root}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={s.heading}>
              <Text style={s.title}>
                Reportar{" "}
                {kind === "user"
                  ? "usuario"
                  : kind === "video"
                    ? "video"
                    : "comentario"}
              </Text>
              <Pressable
                disabled={busy}
                accessibilityLabel="Cerrar reporte"
                onPress={() => setOpen(false)}
                style={{ padding: 12 }}
              >
                <ProppixIcon name="close" color="#052553" />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="always"
              contentContainerStyle={s.content}
            >
              <Text style={s.text}>
                Selecciona el motivo. Tu identidad no se muestra a la cuenta
                reportada.
              </Text>
              {reasons.map(([value, text]) => (
                <Pressable
                  key={value}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: reason === value }}
                  onPress={() => setReason(value)}
                  style={[s.reason, reason === value && s.selected]}
                >
                  <Text style={s.text}>
                    {reason === value ? "● " : "○ "}
                    {text}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                accessibilityLabel="Detalles del reporte"
                placeholder="Cuéntanos qué ocurrió (opcional)"
                placeholderTextColor="#6c7f94"
                maxLength={1000}
                multiline
                value={details}
                onChangeText={setDetails}
                style={s.input}
              />
              {!!error && (
                <Text accessibilityRole="alert" style={{ color: "#a42c3a" }}>
                  {error}
                </Text>
              )}
              <Pressable
                disabled={busy}
                onPress={() => void report()}
                style={s.primary}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.white}>Enviar reporte</Text>
                )}
              </Pressable>
              {authorId && authorId !== session?.user.id && (
                <View style={{ gap: 12, paddingTop: 18 }}>
                  <Text style={s.text}>
                    Al bloquear dejarás de ver sus videos y comentarios. No
                    podrán enviarse mensajes ni seguirse. No se avisa al otro
                    usuario.
                  </Text>
                  <Pressable
                    disabled={busy}
                    style={s.secondary}
                    onPress={() =>
                      Alert.alert(
                        "Bloquear usuario",
                        "Se quitará el seguimiento entre ambas cuentas. Puedes desbloquearlo más adelante.",
                        [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Bloquear",
                            style: "destructive",
                            onPress: () => void block(),
                          },
                        ],
                      )
                    }
                  >
                    <Text style={s.blue}>Bloquear usuario</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  trigger: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  root: { flex: 1, backgroundColor: "#fff" },
  heading: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "800", color: "#052553", flexShrink: 1 },
  content: { padding: 22, paddingBottom: 40, gap: 14 },
  text: { color: "#33506d", fontSize: 14, lineHeight: 21 },
  reason: {
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8e6f2",
  },
  selected: { backgroundColor: "#edfaff", borderColor: "#0866f5" },
  input: {
    color: "#17334c",
    minHeight: 100,
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#eff5fa",
    textAlignVertical: "top",
  },
  primary: {
    padding: 17,
    borderRadius: 24,
    backgroundColor: "#0866f5",
    alignItems: "center",
  },
  white: { color: "#fff", fontWeight: "700" },
  secondary: {
    padding: 16,
    borderRadius: 24,
    borderColor: "#0866f5",
    borderWidth: 1,
    alignItems: "center",
  },
  blue: { color: "#0866f5", fontWeight: "700" },
});
