import {
  PropsWithChildren,
  ComponentRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Keyboard, StyleProp, View, ViewStyle } from "react-native";

// Measure actual keyboard overlap, including Android modal windows and edge-to-edge layouts.
// If Android already resized the window, overlap is zero so it is never applied twice.
export function KeyboardSafeView({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const view = useRef<ComponentRef<typeof View>>(null);
  const keyboardTop = useRef<number | null>(null);
  const [overlap, setOverlap] = useState(0);
  const update = useCallback(() => {
    if (keyboardTop.current === null) {
      setOverlap(0);
      return;
    }
    view.current?.measureInWindow((_x, y, _w, height) => {
      if (keyboardTop.current !== null)
        setOverlap(Math.max(0, y + height - keyboardTop.current));
    });
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      requestAnimationFrame(update);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = null;
      setOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [update]);
  return (
    <View
      ref={view}
      collapsable={false}
      onLayout={update}
      style={[{ flex: 1 }, style, { paddingBottom: overlap }]}
    >
      {children}
    </View>
  );
}
