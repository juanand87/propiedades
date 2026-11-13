import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { api, Session } from "./api";
import { notificationDestination } from "./notification-destination";

let visibleConversation: string | undefined;
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const sameChat =
      !!visibleConversation &&
      notification.request.content.data?.conversationId === visibleConversation;
    return {
      shouldShowBanner: !sameChat,
      shouldShowList: !sameChat,
      shouldPlaySound: !sameChat,
      shouldSetBadge: false,
    };
  },
});

export function useMessageNotifications(
  session: Session | null,
  navigationReady = true,
) {
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
    if (!session || !navigationReady || Platform.OS === "web") return;
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
        if (Platform.OS !== "android") {
          setStatus("Notificaciones disponibles por ahora en Android.");
          return;
        }
        const { data } = await Notifications.getDevicePushTokenAsync();
        if (typeof data !== "string") throw new Error("Invalid device token");
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
  }, [session, retry, navigationReady]);
  useEffect(() => {
    if (!session || !navigationReady || Platform.OS === "web") return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (
        !response ||
        handled.current === response.notification.request.identifier
      )
        return;
      const destination = notificationDestination(
        response.notification.request.content.data,
      );
      if (!destination) return;
      handled.current = response.notification.request.identifier;
      if (destination.kind === "video") {
        void api(`/me/activity/comments/${destination.commentId}/read`, {
          method: "POST",
          token: session.access_token,
        }).catch(() => {});
        router.push({
          pathname: "/video/[videoId]",
          params: {
            videoId: destination.videoId,
            commentId: destination.commentId,
          },
        });
      } else if (destination.kind === "property") {
        void api(`/me/saved-searches/matches/${destination.matchId}/read`, {
          method: "POST",
          token: session.access_token,
        }).catch(() => {});
        router.push({
          pathname: "/property/[propertyId]",
          params: { propertyId: destination.propertyId, from: "catalog" },
        });
      } else if (destination.kind === "conversation")
        router.push({
          pathname: "/mensajes",
          params: { conversationId: destination.conversationId },
        });
      else router.push("/mensajes");
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
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
  }, [session, router, navigationReady]);
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
