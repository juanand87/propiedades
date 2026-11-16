import { ReactNode, useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  GestureDetector,
  useNativeGesture,
  usePanGesture,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { completeCatalogSwipe, pageProgress } from "./home-page-motion";

export function HomePager({
  page,
  enabled,
  scrollGesture,
  feed,
  catalog,
  onCatalog,
}: {
  page: "feed" | "catalog";
  enabled: boolean;
  scrollGesture: ReturnType<typeof useNativeGesture>;
  feed: ReactNode;
  catalog: ReactNode;
  onCatalog: () => void;
}) {
  const { width } = useWindowDimensions();
  const progress = useSharedValue(page === "catalog" ? 1 : 0);
  const dragStart = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withTiming(page === "catalog" ? 1 : 0, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [page, progress]);
  useEffect(() => () => cancelAnimation(progress), [progress]);
  const pan = usePanGesture({
    enabled: enabled && page === "feed",
    activeOffsetX: [-20, 100000],
    failOffsetY: [-18, 18],
    maxPointers: 1,
    block: scrollGesture,
    onActivate: () => {
      cancelAnimation(progress);
      dragStart.set(progress.get());
    },
    onUpdate: (event) => {
      progress.set(pageProgress(dragStart.get(), event.translationX, width));
    },
    onDeactivate: (event) => {
      const complete = completeCatalogSwipe(
        progress.get(),
        event.translationX,
        event.translationY,
        event.velocityX,
        event.canceled,
      );
      progress.set(
        withTiming(
          complete ? 1 : 0,
          { duration: 240, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished && complete) scheduleOnRN(onCatalog);
          },
        ),
      );
    },
  });
  const feedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.get() * width }],
  }));
  const catalogStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.get()) * width }],
  }));
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.viewport}>
        <Animated.View
          style={[styles.page, feedStyle]}
          pointerEvents={page === "feed" ? "auto" : "none"}
          importantForAccessibility={
            page === "feed" ? "auto" : "no-hide-descendants"
          }
          accessibilityElementsHidden={page !== "feed"}
        >
          {feed}
        </Animated.View>
        <Animated.View
          style={[styles.page, catalogStyle]}
          pointerEvents={page === "catalog" ? "auto" : "none"}
          importantForAccessibility={
            page === "catalog" ? "auto" : "no-hide-descendants"
          }
          accessibilityElementsHidden={page !== "catalog"}
        >
          {catalog}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden", backgroundColor: "#fff" },
  page: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
  },
});
