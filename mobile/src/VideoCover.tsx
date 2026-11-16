import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { mediaUrl } from "./api";
// This cover stays mounted underneath the native surface; activating a video never replaces it.
export function VideoCover({
  url,
  preview,
  fit = "contain",
}: {
  url?: string;
  preview?: string | null;
  fit?: "contain" | "cover";
}) {
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: "#102d49",
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <Text style={{ color: "#b9d4e8", fontSize: 27, fontWeight: "800" }}>
        Proppix
      </Text>
      {preview &&
        preview.length < 8192 &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(preview) && (
          <Image
            source={{ uri: preview }}
            fadeDuration={0}
            resizeMode={fit}
            style={StyleSheet.absoluteFill}
          />
        )}
      {url && (
        <Image
          key={url + attempt}
          fadeDuration={0}
          source={{ uri: mediaUrl(url) }}
          resizeMode={fit}
          style={StyleSheet.absoluteFill}
          onError={() => {
            if (attempt < 4)
              timer.current = setTimeout(
                () => setAttempt((n) => n + 1),
                500 * 2 ** attempt,
              );
          }}
        />
      )}
    </View>
  );
}
