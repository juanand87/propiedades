import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import { api, mediaUrl, Page, Property, Session } from "./api";
import { videoColors } from "./video-colors";
import { ProppixIcon } from "./ProppixIcon";
import { VideoSocialData } from "./social-types";

export function SocialVideoActions({
  videoId,
  session,
  onChanged,
  propertyActions,
  propertyFavorite,
  paused = false,
  onResume,
}: {
  videoId: string;
  session: Session | null;
  onChanged?: () => void;
  paused?: boolean;
  onResume?: () => void;
  propertyFavorite?: { ids: string[]; toggle: (id: string) => void };
  propertyActions?: {
    favorite: boolean;
    onFavorite: () => void;
    onDetails: () => void;
    onContact?: () => void;
    onShare: () => void;
  };
}) {
  const router = useRouter();
  const [data, setData] = useState<VideoSocialData | null>(null);
  const [panel, setPanel] = useState<"edit" | "comments" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [reply, setReply] = useState<{
    id: string;
    display_name: string;
  } | null>(null);
  const [comments, setComments] = useState<
    {
      id: string;
      display_name: string;
      body: string;
      parent_id?: string;
      parent_name?: string;
    }[]
  >([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyPage, setPropertyPage] = useState(0);
  const [propertyPages, setPropertyPages] = useState(0);
  const token = session?.access_token;
  useEffect(() => {
    let live = true;
    void api<VideoSocialData>(`/videos/${videoId}/social`, { token })
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [videoId, token]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  function requireSession() {
    if (session) return true;
    Alert.alert("Inicia sesión", "Entra a tu cuenta para participar.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Ir a mi cuenta", onPress: () => router.push("/cuenta") },
    ]);
    return false;
  }
  async function loadProperties(page = 1) {
    const r = await api<Page<Property>>(
      `/manage/properties?limit=24&page=${page}`,
      { token },
    );
    setProperties((old) => (page === 1 ? r.items : [...old, ...r.items]));
    setPropertyPage(r.page);
    setPropertyPages(r.pages);
  }
  async function openComments() {
    setReply(null);
    setPanel("comments");
    await run(async () =>
      setComments(await api(`/videos/${videoId}/comments`, { token })),
    );
  }
  async function download() {
    if (!requireSession()) return;
    await run(async () => {
      const d = await api<{ url: string }>(`/videos/${videoId}/download`, {
        token,
      });
      const file = await File.downloadFileAsync(
        mediaUrl(d.url),
        new File(Paths.cache, `${videoId}.mp4`),
        { idempotent: true },
      );
      const folder = await Directory.pickDirectoryAsync();
      file.copy(new File(folder, `${videoId}.mp4`));
      Alert.alert("Video descargado", "Se guardó en la carpeta que elegiste.");
      setPanel(null);
    });
  }
  const action = (
    icon: "comment" | "heart" | "share" | "bookmark",
    label: string,
    fn: () => void,
    selected = false,
    accessibility = label,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibility}
      disabled={busy}
      onPress={fn}
      accessibilityState={{ selected, disabled: busy }}
      style={({ pressed }) => [
        s.action,
        pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
      ]}
    >
      <View style={s.actionIcon}>
        <ProppixIcon
          name={icon}
          size={icon === "bookmark" ? 29 : 37}
          color={selected ? videoColors.cyan : "#fff"}
          filled={icon !== "bookmark" || selected}
        />
      </View>
      <Text style={[s.count, selected && { color: videoColors.cyan }]}>
        {label}
      </Text>
    </Pressable>
  );
  const option = (label: string, fn: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={fn}
      style={s.option}
    >
      <Text style={s.white}>{label}</Text>
    </Pressable>
  );
  const propertyId = data?.property_id;
  const saved = !!propertyId && !!propertyFavorite?.ids.includes(propertyId);
  return (
    <>
      <View style={s.rail}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver perfil del creador"
          onPress={() =>
            data &&
            router.push({
              pathname: "/perfil/[userId]",
              params: { userId: data.creator.id },
            })
          }
        >
          {data?.creator.avatar_url ? (
            <Image
              source={{ uri: mediaUrl(data.creator.avatar_url) }}
              style={s.avatar}
            />
          ) : (
            <View style={s.avatar}>
              <Text style={s.white}>
                {data?.creator.display_name.slice(0, 1) || "●"}
              </Text>
            </View>
          )}
        </Pressable>
        {data && session?.user.id !== data.creator.id && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              data.creator.followed
                ? "Dejar de seguir al creador"
                : "Seguir al creador"
            }
            accessibilityState={{
              selected: data.creator.followed,
              disabled: busy,
            }}
            disabled={busy}
            style={[s.follow, data.creator.followed && s.following]}
            onPress={() => {
              if (!requireSession()) return;
              void run(async () => {
                const creator = await api<VideoSocialData["creator"]>(
                  `/video-profiles/${data.creator.id}/follow`,
                  {
                    method: "POST",
                    token,
                    body: { active: !data.creator.followed },
                  },
                );
                setData({ ...data, creator });
              });
            }}
          >
            <ProppixIcon
              name={data.creator.followed ? "check" : "plus"}
              size={13}
              color={data.creator.followed ? "#fff" : "#052553"}
            />
            <Text
              style={[s.followText, data.creator.followed && { color: "#fff" }]}
            >
              {data.creator.followed ? "Siguiendo" : "Seguir"}
            </Text>
          </Pressable>
        )}
        {action(
          "heart",
          String(data?.likes ?? 0),
          () => {
            if (!data || !requireSession()) return;
            void run(async () => {
              setData(
                await api<VideoSocialData>(`/videos/${videoId}/like`, {
                  method: "POST",
                  token,
                  body: { active: !data.liked },
                }),
              );
              onChanged?.();
            });
          },
          data?.liked,
          data?.liked ? "Quitar me gusta al video" : "Dar me gusta al video",
        )}
        {action(
          "comment",
          String(data?.comments ?? 0),
          () => void openComments(),
          false,
          `Comentarios: ${data?.comments ?? 0}`,
        )}
        {propertyActions &&
          action(
            "bookmark",
            propertyActions.favorite ? "Guardado" : "Guardar",
            propertyActions.onFavorite,
            propertyActions.favorite,
            propertyActions.favorite
              ? "Quitar propiedad de favoritos"
              : "Guardar propiedad",
          )}
        {!propertyActions &&
          propertyFavorite &&
          propertyId &&
          action(
            "bookmark",
            saved ? "Guardado" : "Guardar",
            () => propertyFavorite.toggle(propertyId),
            saved,
            saved ? "Quitar propiedad de favoritos" : "Guardar propiedad",
          )}
        {propertyActions
          ? action("share", "Compartir", propertyActions.onShare)
          : data?.status === "published" &&
            action(
              "share",
              "Compartir",
              () => void Share.share({ message: data.share_url }),
            )}
      </View>
      <View style={s.caption} pointerEvents="box-none">
        <Text style={s.name}>
          @{data?.creator.display_name || "Propiedades"}
        </Text>
        {propertyFavorite &&
          data?.can_edit &&
          option("Editar video", () => {
            setTitle(data.title);
            setPanel("edit");
            void run(() => loadProperties());
          })}
        <Text style={s.white}>
          {data?.title.replace(/^Recorrido(?: ilustrativo)?\s*·\s*/i, "")}
        </Text>
        {propertyActions
          ? option("Ver propiedad ↗", propertyActions.onDetails)
          : data?.property_id &&
            option("Ver propiedad ↗", () =>
              router.push({
                pathname: "/property/[propertyId]",
                params: { propertyId: data.property_id! },
              }),
            )}
        {propertyActions?.onContact &&
          option("Consultar al vendedor", propertyActions.onContact)}
      </View>
      {!!error && !panel && (
        <View style={s.inlineError}>
          <Text style={s.white}>{error}</Text>
        </View>
      )}
      {paused && data && session?.user.id === data.creator.id && (
        <View style={s.pausedOptions}>
          <Text style={s.pausedTitle}>Tu video, tu propiedad</Text>
          {!!data.property_title && (
            <Text style={s.pausedSubtitle} numberOfLines={2}>
              {data.property_title}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            style={s.createProperty}
            onPress={() =>
              router.push({
                pathname: "/mis-videos",
                params: {
                  videoId,
                  propertyMode: "new",
                  profileSection: "properties",
                },
              })
            }
          >
            <ProppixIcon name="plus" size={19} />
            <Text style={s.propertyActionText}>Crear propiedad en Proppix</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={s.linkProperty}
            onPress={() =>
              router.push({
                pathname: "/mis-videos",
                params: {
                  videoId,
                  propertyMode: "link",
                  profileSection: "properties",
                },
              })
            }
          >
            <ProppixIcon name="house" size={19} />
            <Text style={s.propertyActionText}>
              Enlazar a una propiedad existente
            </Text>
          </Pressable>
          {onResume && (
            <Pressable
              accessibilityRole="button"
              style={s.resume}
              onPress={onResume}
            >
              <Text style={s.propertyActionText}>Continuar viendo</Text>
            </Pressable>
          )}
        </View>
      )}
      <Modal
        visible={panel !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPanel(null)}
      >
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.heading}>
              <Text style={s.name}>
                {panel === "comments" ? "Comentarios" : "Editar video"}
              </Text>
              {option("Cerrar", () => setPanel(null))}
            </View>
            {busy && <ActivityIndicator color={videoColors.cyan} />}
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <ScrollView keyboardShouldPersistTaps="handled">
              {panel === "edit" && (
                <>
                  {option("Descargar", () => void download())}
                  {option("Eliminar video", () =>
                    Alert.alert(
                      "Eliminar video",
                      "Se quitará de tu perfil y liberará un espacio en tu plan.",
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Eliminar",
                          style: "destructive",
                          onPress: () =>
                            void run(async () => {
                              await api(`/manage/videos/${videoId}`, {
                                method: "PATCH",
                                token,
                                body: { status: "archived" },
                              });
                              setPanel(null);
                              onChanged?.();
                            }),
                        },
                      ],
                    ),
                  )}
                  {!data?.property_id &&
                    option("Agregar datos de esta propiedad", () => {
                      setPanel(null);
                      router.push({
                        pathname: "/mis-videos",
                        params: { videoId, propertyMode: "new" },
                      });
                    })}
                  <Text style={s.muted}>Título</Text>
                  <TextInput
                    accessibilityLabel="Editar título del video"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={160}
                    style={s.input}
                  />
                  {option(
                    "Guardar título",
                    () =>
                      void run(async () => {
                        await api(`/manage/videos/${videoId}`, {
                          method: "PATCH",
                          token,
                          body: { title },
                        });
                        setData(
                          await api(`/videos/${videoId}/social`, { token }),
                        );
                        onChanged?.();
                        setPanel(null);
                      }),
                  )}
                  {option(
                    data?.status === "published"
                      ? "Dejar como borrador"
                      : "Publicar video",
                    () =>
                      void run(async () => {
                        await api(`/manage/videos/${videoId}`, {
                          method: "PATCH",
                          token,
                          body: {
                            status:
                              data?.status === "published"
                                ? "draft"
                                : "published",
                          },
                        });
                        setData(
                          await api(`/videos/${videoId}/social`, { token }),
                        );
                        onChanged?.();
                        setPanel(null);
                      }),
                  )}
                  <Text style={s.name}>Propiedad vinculada · opcional</Text>
                  <Text style={s.muted}>
                    {data?.property_title || "Sin propiedad vinculada"}. Cambiar
                    el vínculo deja el video como borrador.
                  </Text>
                  {data?.property_id &&
                    option(
                      "Quitar vínculo",
                      () =>
                        void run(async () => {
                          setData(
                            await api(`/manage/videos/${videoId}/property`, {
                              method: "POST",
                              token,
                              body: { property_id: null },
                            }),
                          );
                          onChanged?.();
                        }),
                    )}
                  {properties.map((p) => (
                    <View key={p.id}>
                      {option(
                        `⌂ ${p.title}`,
                        () =>
                          void run(async () => {
                            setData(
                              await api(`/manage/videos/${videoId}/property`, {
                                method: "POST",
                                token,
                                body: { property_id: p.id },
                              }),
                            );
                            onChanged?.();
                          }),
                      )}
                    </View>
                  ))}
                  {!properties.length && !busy && (
                    <Text style={s.muted}>
                      No tienes propiedades para vincular. Puedes mantener el
                      video independiente.
                    </Text>
                  )}
                  {propertyPage < propertyPages &&
                    option(
                      "Cargar más propiedades",
                      () => void run(() => loadProperties(propertyPage + 1)),
                    )}
                </>
              )}
              {panel === "comments" && (
                <>
                  {!comments.length && (
                    <Text style={s.muted}>Sé el primero en comentar.</Text>
                  )}
                  {comments.map((c) => (
                    <View key={c.id} style={s.comment}>
                      <Text style={s.name}>{c.display_name}</Text>
                      {c.parent_id && (
                        <Text style={s.muted}>
                          En respuesta a {c.parent_name || "un comentario"}
                        </Text>
                      )}
                      <Text style={s.white}>{c.body}</Text>
                      {option("Responder", () => {
                        if (requireSession()) setReply(c);
                      })}
                    </View>
                  ))}
                  {reply &&
                    option(
                      "Respondiendo a " + reply.display_name + " · Cancelar",
                      () => setReply(null),
                    )}
                  <TextInput
                    accessibilityLabel="Escribe un comentario"
                    placeholder="Escribe un comentario…"
                    placeholderTextColor={videoColors.muted}
                    value={comment}
                    onChangeText={setComment}
                    maxLength={2000}
                    style={s.input}
                  />
                  {option("Enviar comentario", () => {
                    if (requireSession())
                      void run(async () => {
                        setComments(
                          await api(`/videos/${videoId}/comments`, {
                            method: "POST",
                            token,
                            body: { body: comment, parent_id: reply?.id },
                          }),
                        );
                        setComment("");
                        setReply(null);
                        setData(
                          await api(`/videos/${videoId}/social`, { token }),
                        );
                        onChanged?.();
                      });
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  rail: {
    position: "absolute",
    right: 7,
    bottom: 100,
    alignItems: "center",
    gap: 9,
    width: 76,
  },
  action: { alignItems: "center", minWidth: 60, minHeight: 53, gap: 3 },
  actionIcon: {
    width: 46,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: "#00142b22",
  },
  follow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: videoColors.cyan,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 16,
    minHeight: 30,
  },
  following: {
    backgroundColor: "#092954bb",
    borderWidth: 1,
    borderColor: "#ffffff88",
  },
  followText: { color: "#052553", fontSize: 10, fontWeight: "800" },
  pausedOptions: {
    position: "absolute",
    top: "28%",
    left: 16,
    right: 92,
    backgroundColor: "#062951f2",
    borderColor: "#ffffff33",
    borderWidth: 1,
    borderRadius: 23,
    padding: 17,
    gap: 12,
  },
  pausedTitle: { color: "#fff", fontSize: 19, fontWeight: "800" },
  pausedSubtitle: { color: videoColors.muted, fontSize: 12 },
  createProperty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 13,
    backgroundColor: "#0866f5",
    borderRadius: 15,
  },
  linkProperty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 13,
    backgroundColor: "#174778",
    borderRadius: 15,
  },
  propertyActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  resume: { alignItems: "center", padding: 8 },
  icon: {
    color: "#fff",
    fontSize: 35,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 5,
  },
  count: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: videoColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { position: "absolute", bottom: 28, left: 18, right: 90, gap: 7 },
  name: { color: "#fff", fontWeight: "800", fontSize: 17 },
  white: { color: "#fff", fontSize: 14 },
  muted: { color: videoColors.muted, paddingVertical: 12 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: videoColors.border,
    minHeight: 48,
  },
  backdrop: { flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: videoColors.surface,
    padding: 20,
    paddingBottom: 35,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
  },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  input: {
    color: "#fff",
    backgroundColor: videoColors.border,
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  error: { color: "#ffb5ac", padding: 10 },
  inlineError: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "#782f2f",
    padding: 14,
    borderRadius: 12,
  },
  comment: {
    paddingVertical: 14,
    borderBottomColor: videoColors.border,
    borderBottomWidth: 1,
  },
});
