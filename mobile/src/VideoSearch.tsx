import { brandColors } from "./brand-colors";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, Page, Video } from "./api";
import { VideoCover } from "./VideoCover";
import { KeyboardSafeView } from "./KeyboardSafeView";

export function VideoSearch({
  token,
  onClose,
  onOpen,
}: {
  token?: string;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState<Video[]>([]),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = query.trim();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setItems([]);
      setPage(0);
      setPages(0);
      setError("");
      setBusy(q.length >= 2);
      if (q.length < 2) return;
      void api<Page<Video>>(
        `/videos?limit=20&search=${encodeURIComponent(q)}`,
        { token, signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted) {
            setItems(result.items);
            setPage(result.page);
            setPages(result.pages);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "No se pudo buscar.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, token]);
  // Explicit pagination keeps search finite; the Inicio feed remains independent.
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    if (!extra || extra <= page || extra > pages) return;
    const controller = new AbortController();
    void api<Page<Video>>(
      `/videos?limit=20&search=${encodeURIComponent(q)}&page=${extra}`,
      { token, signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems((old) => [
            ...old,
            ...result.items.filter((v) => !old.some((p) => p.id === v.id)),
          ]);
          setPage(result.page);
          setPages(result.pages);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(String(e.message));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [extra, q, token, page, pages]);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <KeyboardSafeView>
          <View
            style={{
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontSize: 23,
                fontWeight: "800",
                color: brandColors.secondary,
              }}
            >
              Buscar videos
            </Text>
            <Pressable
              accessibilityLabel="Cerrar búsqueda"
              onPress={onClose}
              style={{ padding: 10 }}
            >
              <Text style={{ fontSize: 26, color: brandColors.secondary }}>
                ×
              </Text>
            </Pressable>
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={(value) => {
              setExtra(0);
              setQuery(value);
            }}
            placeholder="Título del video"
            placeholderTextColor={brandColors.secondary}
            accessibilityLabel="Buscar videos por título"
            maxLength={100}
            returnKeyType="search"
            style={{
              marginHorizontal: 18,
              padding: 15,
              borderRadius: 16,
              backgroundColor: brandColors.secondarySurface,
              color: brandColors.secondary,
            }}
          />
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={{ padding: 18, color: "#b02b3b" }}
            >
              {error}
            </Text>
          )}
          <FlatList
            data={items}
            numColumns={2}
            keyboardShouldPersistTaps="always"
            keyExtractor={(v) => v.id}
            contentContainerStyle={{ padding: 14 }}
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel={`Ver video ${item.title}`}
                onPress={() => onOpen(item.id)}
                style={{ flex: 1, maxWidth: "50%", padding: 4 }}
              >
                <View
                  style={{
                    aspectRatio: 0.7,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <VideoCover
                    url={item.thumbnail_url}
                    preview={item.thumbnail_preview}
                    fit="cover"
                  />
                </View>
                <Text
                  numberOfLines={2}
                  style={{ color: brandColors.secondary, paddingVertical: 8 }}
                >
                  {item.title}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              !busy && !error ? (
                <Text style={{ padding: 20, color: brandColors.secondary }}>
                  {q.length < 2
                    ? "Escribe al menos 2 caracteres del título."
                    : "No encontramos videos con ese título."}
                </Text>
              ) : undefined
            }
            ListFooterComponent={
              busy ? (
                <ActivityIndicator color={brandColors.secondary} />
              ) : page < pages ? (
                <Pressable
                  onPress={() => {
                    setBusy(true);
                    setError("");
                    setExtra(page + 1);
                  }}
                  style={{ padding: 18 }}
                >
                  <Text
                    style={{
                      color: brandColors.secondary,
                      textAlign: "center",
                    }}
                  >
                    Cargar más videos
                  </Text>
                </Pressable>
              ) : undefined
            }
          />
        </KeyboardSafeView>
      </SafeAreaView>
    </Modal>
  );
}
