import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api, ApiError, errorMessage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Snapshot } from "@/lib/types";

export function usePos(restaurantId: string) {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false),
    [live, setLive] = useState(false),
    [blocked, setBlocked] = useState(false);
  const running = useRef(false),
    alive = useRef(true),
    loaded = useRef(false),
    catalogDirty = useRef(false);
  const refresh = useCallback(
    async (catalog = false) => {
      if (running.current) {
        return;
      }
      running.current = true;
      setRefreshing(true);
      try {
        const snapshot = await api<Snapshot>(
          "?restaurantId=" +
            restaurantId +
            "&catalog=" +
            (!loaded.current || catalog ? "1" : "0"),
        );
        if (alive.current) {
          setData((previous) => ({ ...previous, ...snapshot }));
          loaded.current = true;
          if (catalog) catalogDirty.current = false;
          setError("");
          setBlocked(false);
        }
      } catch (e) {
        if (alive.current) {
          setError(errorMessage(e));
          if (e instanceof ApiError && [401, 403].includes(e.status)) {
            setBlocked(true);
            setData(null);
          }
        }
      } finally {
        running.current = false;
        if (alive.current) {
          setRefreshing(false);
        }
      }
    },
    [restaurantId],
  );
  useEffect(() => {
    alive.current = true;
    void refresh(true);
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (catalog = false) => {
      if (catalog) catalogDirty.current = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (AppState.currentState === "active") void refresh(catalogDirty.current);
      }, 700);
    };
    let channel = supabase?.channel("pos-" + restaurantId);
    for (const table of ["orders", "cash_sessions", "cash_movements", "tables", "order_delivery_links", "restaurant_settings"])
      channel = channel?.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: "restaurant_id=eq." + restaurantId,
        },
        () => schedule(false),
      );
    channel = channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "products", filter: "restaurant_id=eq." + restaurantId },
      () => schedule(true),
    );
    channel?.subscribe((state) => {
      if (alive.current) {
        setLive(state === "SUBSCRIBED");
      }
    });
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void refresh(false);
    }, 60000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh(catalogDirty.current);
    });
    return () => {
      alive.current = false;
      clearTimeout(timer);
      clearInterval(interval);
      app.remove();
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [refresh, restaurantId]);
  return { data, error, refreshing, refresh, live, blocked };
}
