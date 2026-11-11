import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import Constants from "expo-constants";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { api, Session } from "./api";

let visibleConversation: string | undefined;
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const sameChat =
      notification.request.content.data?.conversationId === visibleConversation;
    return {
      shouldShowBanner: !sameChat,
      shouldShowList: !sameChat,
      shouldPlaySound: !sameChat,
      shouldSetBadge: false,
    };
  },
});

export function useMessageNotifications(session: Session | null) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ conversationId?: string }>();
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  const handled = useRef<string | null>(null);
  const registered = useRef<{ token: string; auth: string } | null>(null);
  const pendingRegistration = useRef<Promise<void> | null>(null);
  const stopping = useRef(false);
  useEffect(() => {
    visibleConversation =
      pathname === "/mensajes" ? params.conversationId : undefined;
    return () => {
      visibleConversation = undefined;
    };
  }, [pathname, params.conversationId]);
  useEffect(() => {
    if (!session || Platform.OS === "web") return;
    stopping.current = false;
    let live = true;
    let registering = false;
    async function register() {
      if (registering || stopping.current) return;
      registering = true;
      try {
        if (Platform.OS === "android")
          await Notifications.setNotificationChannelAsync("messages", {
            name: "Mensajes",
            importance: AndroidImportance.HIGH,
            sound: "default",
            vibrationPattern: [0, 200, 100, 200],
          });
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && permission.canAskAgain)
          permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) {
          if (live)
            setStatus(
              "Activa las notificaciones en los ajustes de tu teléfono para recibir avisos.",
            );
          return;
        }
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as
          | string
          | undefined;
        if (!projectId) throw new Error("Project unavailable");
        const { data } = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        if (!live || stopping.current) return;
        await api("/messages/devices", {
          method: "POST",
          token: session!.access_token,
          body: { token: data },
        });
        if (!live) {
          await api("/messages/devices", {
            method: "POST",
            token: session!.access_token,
            body: { token: data, enabled: false },
          }).catch(() => {});
          return;
        }
        registered.current = { token: data, auth: session!.access_token };
        setStatus("Notificaciones de mensajes activas");
      } catch {
        if (live)
          setStatus(
            "No se pudieron activar las notificaciones. Puedes reintentar.",
          );
      } finally {
        registering = false;
      }
    }
    const run = () => {
      if (!registering) pendingRegistration.current = register();
    };
    run();
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    const tokenChange = Notifications.addPushTokenListener(() => {
      run();
    });
    return () => {
      live = false;
      foreground.remove();
      tokenChange.remove();
    };
  }, [session, retry]);
  useEffect(() => {
    if (!session || Platform.OS === "web") return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (
        !response ||
        handled.current === response.notification.request.identifier
      )
        return;
      const conversationId =
        response.notification.request.content.data?.conversationId;
      if (
        typeof conversationId !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(conversationId)
      )
        return;
      handled.current = response.notification.request.identifier;
      router.push({ pathname: "/mensajes", params: { conversationId } });
      void Notifications.clearLastNotificationResponseAsync();
    };
    let live = true;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (live) open(response);
    });
    const listener =
      Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      live = false;
      listener.remove();
    };
  }, [session, router]);
  async function unregister() {
    stopping.current = true;
    await pendingRegistration.current;
    const device = registered.current;
    if (!device) return;
    await api("/messages/devices", {
      method: "POST",
      token: device.auth,
      body: { token: device.token, enabled: false },
    });
    registered.current = null;
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.clearLastNotificationResponseAsync();
  }
  return { status, retry: () => setRetry((value) => value + 1), unregister };
}
