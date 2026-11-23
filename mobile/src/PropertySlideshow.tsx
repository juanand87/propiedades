import { useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { mediaUrl, Property } from "./api";

export function PropertySlideshow({ media }: { media: Property["media"] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const list = useRef<FlatList<Property["media"][number]>>(null);
  if (!media.length) return null;
  return (
    <View>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={s.root}
      >
        {width > 0 && (
          <FlatList
            key={width}
            ref={list}
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
                resizeMode="cover"
              />
            )}
          />
        )}
        <Text style={s.counter}>
          {Math.min(index + 1, media.length)} / {media.length}
        </Text>
        <Pressable
          accessibilityLabel="Ampliar foto"
          onPress={() => setFullscreen(true)}
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            backgroundColor: "#0009",
            borderRadius: 20,
            padding: 10,
          }}
        >
          <Text style={{ color: "#fff" }}>⛶</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 7,
          paddingHorizontal: 12,
          paddingBottom: 15,
        }}
      >
        {media.map((item, i) => (
          <Pressable
            key={item.id}
            accessibilityLabel={`Ver foto ${i + 1}`}
            accessibilityState={{ selected: index === i }}
            onPress={() => {
              setIndex(i);
              list.current?.scrollToOffset({
                offset: i * width,
                animated: true,
              });
            }}
          >
            <Image
              source={{ uri: mediaUrl(item.url) }}
              style={{
                width: 70,
                height: 58,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: index === i ? "#0866f5" : "transparent",
              }}
            />
          </Pressable>
        ))}
      </ScrollView>
      <Modal
        visible={fullscreen}
        transparent
        onRequestClose={() => setFullscreen(false)}
      >
        <View
          style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}
        >
          <Image
            source={{ uri: mediaUrl(media[index].url) }}
            style={{ width: "100%", height: "85%" }}
            resizeMode="contain"
          />
          <Pressable
            accessibilityLabel="Cerrar foto"
            onPress={() => setFullscreen(false)}
            style={{ position: "absolute", top: 45, right: 20, padding: 14 }}
          >
            <Text style={{ color: "#fff", fontSize: 28 }}>×</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: {
    height: 260,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#061b35",
    marginBottom: 7,
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
