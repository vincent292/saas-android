import { useEffect, useMemo, useState } from "react";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import type { Order } from "@/lib/types";

export type PosNotificationStatus = "checking" | "ready" | "denied" | "unsupported" | "error";

const alertSound = require("../../assets/notificaciones/notificaiones.mp3");

export function usePosNotifications({
  enabled,
  onOpen,
  orders,
  restaurantId,
}: {
  enabled: boolean;
  onOpen: () => void;
  orders: Order[];
  restaurantId: string;
}) {
  const player = useAudioPlayer(alertSound);
  const supported =
    enabled &&
    Platform.OS !== "web" &&
    !(Platform.OS === "android" && Constants.appOwnership === "expo");
  const [status, setStatus] = useState<PosNotificationStatus>(
    supported ? "checking" : "unsupported",
  );
  const [silencedIds, setSilencedIds] = useState<string[]>([]);
  const pendingOrders = useMemo(
    () => enabled ? orders.filter((order) => order.status === "pending" && order.order_type !== "pos") : [],
    [enabled, orders],
  );
  const sounding = pendingOrders.some((order) => !silencedIds.includes(order.id));

  useEffect(() => {
    void setAudioModeAsync({ interruptionMode: "doNotMix", playsInSilentMode: true });
  }, []);

  useEffect(() => {
    // Expo Audio exposes playback controls as mutable properties on its player object.
    // eslint-disable-next-line react-hooks/immutability
    player.loop = true;
    if (sounding) {
      void player.seekTo(0).then(() => player.play()).catch(() => undefined);
    } else {
      player.pause();
    }
    return () => player.pause();
  }, [player, sounding]);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let received: { remove: () => void } | undefined;
    let response: { remove: () => void } | undefined;

    async function initialize() {
      const Notifications = await import("expo-notifications");
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("pos-orders", {
          importance: Notifications.AndroidImportance.MAX,
          lightColor: "#C7F000",
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          name: "Pedidos nuevos",
          sound: "notificaiones.mp3",
          vibrationPattern: [0, 300, 200, 300],
        });
      }

      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Notifications.requestPermissionsAsync();
      }
      if (!permission.granted) {
        if (!cancelled) setStatus("denied");
        return;
      }

      received = Notifications.addNotificationReceivedListener((notification) => {
        if (notification.request.content.data?.type === "pos_new_order") onOpen();
      });
      response = Notifications.addNotificationResponseReceivedListener((event) => {
        if (event.notification.request.content.data?.type === "pos_new_order") onOpen();
      });
      const last = Notifications.getLastNotificationResponse();
      if (last?.notification.request.content.data?.type === "pos_new_order") {
        onOpen();
        await Notifications.clearLastNotificationResponseAsync();
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) throw new Error("missing-project-id");
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      const expoPushToken = (
        await Notifications.getExpoPushTokenAsync({ devicePushToken, projectId })
      ).data;
      await api("", {
        action: "register-pos-push",
        appVersion: Constants.expoConfig?.version,
        deviceId: [Device.brand, Device.modelName].filter(Boolean).join(" "),
        expoPushToken,
        platform: Platform.OS,
        restaurantId,
      });
      if (!cancelled) setStatus("ready");
    }

    void initialize().catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
      received?.remove();
      response?.remove();
    };
  }, [onOpen, restaurantId, supported]);

  return {
    pendingCount: pendingOrders.length,
    sounding,
    status: supported ? status : "unsupported",
    stopSound: () => setSilencedIds(pendingOrders.map((order) => order.id)),
  };
}
