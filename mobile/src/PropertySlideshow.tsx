import { useState } from "react";
import { FlatList, Image, StyleSheet, Text, View } from "react-native";
import { mediaUrl, Property } from "./api";

export function PropertySlideshow({ media }: { media: Property["media"] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  if (!media.length) return null;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={s.root}>
      {width > 0 && (
        <FlatList
          key={width}
          horizontal
          pagingEnabled
          data={media}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <Image
              accessibilityLabel={item.alt_text || "Foto de la propiedad"}
              source={{ uri: mediaUrl(item.url) }}
              style={{ width, height: 260 }}
              resizeMode="contain"
            />
          )}
        />
      )}
      <Text style={s.counter}>
        {Math.min(index + 1, media.length)} / {media.length}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  root: {
    height: 260,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#061b35",
    marginBottom: 18,
  },
  counter: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "#0009",
    color: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
});
