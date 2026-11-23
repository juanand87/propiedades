import { brandColors } from "./brand-colors";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { VideoUploadProgress as Progress } from "./video-upload";

export function VideoUploadProgress({
  progress,
  embedded = false,
}: {
  progress: Progress | null;
  embedded?: boolean;
}) {
  const percent =
    progress && progress.total > 0
      ? Math.min(
          100,
          Math.max(0, Math.floor((progress.sent / progress.total) * 100)),
        )
      : undefined;
  const content = (
    <View style={s.screen} accessibilityViewIsModal>
      <StatusBar style="dark" />
      <View style={s.card}>
        <ActivityIndicator size="large" color={brandColors.secondary} />
        <Text style={s.title}>
          {progress?.phase === "processing"
            ? "Confirmando la carga"
            : "Estamos cargando el video"}
        </Text>
        <Text style={s.description} accessibilityLiveRegion="polite">
          {progress?.phase === "processing"
            ? "El envío terminó. Espera la confirmación de que tu video quedó guardado para procesarlo."
            : progress?.phase === "retrying"
              ? "Estamos intentando reconectar…"
              : progress?.phase === "connecting"
                ? "Conectando con Proppix…"
                : "Mantén la app abierta hasta que termine la carga."}
        </Text>
        <View
          style={s.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Progreso de carga del video"
          accessibilityValue={
            percent === undefined
              ? { text: "Conectando" }
              : { min: 0, max: 100, now: percent }
          }
        >
          <View style={[s.fill, { width: `${percent ?? 0}%` }]} />
        </View>
        <Text style={s.percent}>
          {percent === undefined
            ? "Preparando el envío…"
            : `${percent}% enviado`}
        </Text>
        {progress && progress.total > 0 && (
          <Text style={s.description}>
            {(progress.sent / 1048576).toFixed(1)} de{" "}
            {(progress.total / 1048576).toFixed(1)} MB
          </Text>
        )}
        <Text style={s.note}>
          Espera aquí. Al terminar podrás continuar con tu video. Si falla la
          conexión, podrás reintentar sin duplicarlo.
        </Text>
      </View>
    </View>
  );
  if (embedded) return progress ? content : null;
  return (
    <Modal
      visible={progress !== null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}
    >
      {content}
    </Modal>
  );
}
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.secondarySurface,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderColor: brandColors.secondarySurface,
    borderWidth: 1,
    gap: 18,
  },
  title: {
    color: brandColors.secondary,
    fontSize: 25,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: brandColors.secondary,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
  track: {
    height: 12,
    borderRadius: 8,
    backgroundColor: "#e6effb",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: brandColors.secondary,
    borderRadius: 8,
  },
  percent: {
    color: brandColors.secondary,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  note: {
    color: brandColors.secondary,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
  },
});
