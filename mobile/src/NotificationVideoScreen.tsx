import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, ApiError, Session } from "./api";
import { ProfileVideo, VideoSocialData } from "./social-types";
import { FullVideo } from "./VideoProfile";
import { ProppixIcon } from "./ProppixIcon";

export function NotificationVideoScreen({
  videoId,
  commentId,
  session,
}: {
  videoId?: string;
  commentId?: string;
  session: Session | null;
}) {
  const router = useRouter();
  const [video, setVideo] = useState<ProfileVideo | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const token = session?.access_token;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError("");
      setVideo(null);
      try {
        if (!videoId)
          throw new Error("La notificación no contiene un video válido.");
        const data = await api<VideoSocialData>(
          `/videos/${encodeURIComponent(videoId)}/social`,
          { token, signal: controller.signal },
        );
        let hlsUrl = data.hls_url;
        let url = `/api/videos/${data.id}/content`;
        if (data.can_edit && data.creator.id !== session?.user.id) {
          const preview = await api<{ url: string; hls_url?: string | null }>(
            `/manage/videos/${data.id}/preview`,
            { token, signal: controller.signal },
          );
          url = preview.url;
          hlsUrl = preview.hls_url;
        }
        if (!controller.signal.aborted)
          setVideo({
            id: data.id,
            created_by: data.creator.id,
            title: data.title,
            status: data.status,
            property_id: data.property_id,
            property_title: data.property_title,
            duration_ms: null,
            likes: data.likes,
            url,
            hls_url: hlsUrl,
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof ApiError &&
              (error.status === 403 || error.status === 404)
              ? "Este video ya no está disponible o no tienes acceso a él."
              : error instanceof Error
                ? error.message
                : "No se pudo abrir el video.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [videoId, token, session?.user.id, retry]);
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }
  return (
    <View style={s.root}>
      {video ? (
        <FullVideo
          key={video.id + ":" + commentId}
          video={video}
          active
          session={session}
          onChanged={() => {}}
          initialCommentId={commentId}
        />
      ) : (
        <View style={s.center}>
          {error ? (
            <>
              <Text accessibilityRole="alert" style={s.text}>
                {error}
              </Text>
              <Pressable
                onPress={() => setRetry((value) => value + 1)}
                style={s.button}
              >
                <Text style={s.text}>Reintentar</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar video"
        onPress={close}
        style={s.close}
      >
        <ProppixIcon name="close" />
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 20,
  },
  text: { color: "#fff", textAlign: "center", lineHeight: 22 },
  button: { padding: 14, borderRadius: 20, backgroundColor: "#0866f5" },
  close: {
    position: "absolute",
    top: 12,
    left: 14,
    padding: 12,
    borderRadius: 24,
    backgroundColor: "#0009",
  },
});
