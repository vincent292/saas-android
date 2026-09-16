import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Banknote,
  ClipboardList,
  Clock3,
  LogOut,
  Play,
  RefreshCw,
  ShoppingCart,
  Store,
} from "lucide-react-native";
import { usePos } from "@/hooks/use-pos";
import { api, errorMessage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Profile, Restaurant } from "@/lib/types";
import { Button, c, Empty, IconButton, Label, Notice, s, Sheet } from "./ui";
import { Sale } from "./Sale";
import { Orders } from "./Orders";
import { Cash } from "./Cash";
export function Workspace({
  restaurant,
  profile,
  change,
}: {
  restaurant: Restaurant;
  profile: Profile;
  change: () => void;
}) {
  const { data, error, refreshing, refresh, live } = usePos(restaurant.id);
  const [tab, setTab] = useState("sale"),
    [account, setAccount] = useState(false),
    [message, setMessage] = useState(""),
    [shiftBusy, setShiftBusy] = useState(false),
    [shiftError, setShiftError] = useState("");
  const manager = data?.restaurant.canManage ?? restaurant.canManage;
  const tabs = [
    { id: "sale", label: "Nuevo pedido", icon: ShoppingCart },
    ...(manager
      ? [
          { id: "orders", label: "Pedidos", icon: ClipboardList },
          { id: "cash", label: "Caja", icon: Banknote },
        ]
      : []),
  ];
  const current = tab === "cash" && !manager ? "sale" : tab;
  async function setShift(open: boolean) {
    if (shiftBusy) return;
    setShiftBusy(true);
    setShiftError("");
    try {
      await api("", {
        restaurantId: restaurant.id,
        action: open ? "open-waiter-shift" : "close-waiter-shift",
      });
      await refresh(false);
      setMessage(open ? "Turno iniciado." : "Turno cerrado.");
      if (!open) setAccount(false);
    } catch (e) {
      setShiftError(errorMessage(e));
    } finally {
      setShiftBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.white }}>
      <View
        style={{ flex: 1, width: "100%", maxWidth: 1200, alignSelf: "center" }}
      >
        <View
          style={[
            s.between,
            {
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderColor: c.line,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cuenta y restaurante"
            onPress={() => setAccount(true)}
            style={{ flex: 1, gap: 4 }}
          >
            <Text
              numberOfLines={1}
              style={{ color: c.ink, fontSize: 19, fontWeight: "800" }}
            >
              {restaurant.name}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: c.muted }}>
              {profile.full_name} · {manager ? "Caja / POS" : "Mesero"}
            </Text>
          </Pressable>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={{ fontSize: 11, color: live ? c.green : c.muted }}>
              {live ? "En vivo" : "Sincronizando"}
            </Text>
            <IconButton
              icon={RefreshCw}
              label="Actualizar"
              disabled={refreshing}
              onPress={() => void refresh(true)}
            />
          </View>
        </View>
        {Boolean(error) && (
          <View style={{ padding: 12 }}>
            <Notice error message={error} />
          </View>
        )}
        {Boolean(message) && (
          <Pressable
            accessibilityLabel="Cerrar aviso"
            onPress={() => setMessage("")}
            style={{ padding: 12 }}
          >
            <Notice message={message} />
          </Pressable>
        )}
        {!data ? (
          refreshing ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <ActivityIndicator color={c.ink} />
            </View>
          ) : (
            <Empty
              title="No se pudo cargar el POS"
              action={
                <Button
                  title="Reintentar"
                  icon={RefreshCw}
                  onPress={() => void refresh(true)}
                />
              }
            />
          )
        ) : (
          <View style={{ flex: 1, backgroundColor: c.page }}>
            {!manager && !data.waiterShift?.active ? (
              <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
                <Empty
                  title="Turno cerrado"
                  detail="Registra tu entrada para escanear mesas y enviar pedidos."
                  action={
                    <View style={{ width: "100%", maxWidth: 360, gap: 10 }}>
                      <Notice error message={shiftError} />
                      <Button title="Abrir turno" icon={Play} busy={shiftBusy} onPress={() => void setShift(true)} />
                    </View>
                  }
                />
              </View>
            ) : (
              <>
                <View style={{ flex: 1, display: current === "sale" ? "flex" : "none" }}>
                  <Sale
                    key={manager ? "manager" : "waiter"}
                    data={data}
                    onRefresh={() => refresh(false)}
                    onSent={setMessage}
                  />
                </View>
                {current === "orders" && manager ? <Orders data={data} onRefresh={() => refresh()} /> : null}
                {current === "cash" && manager ? <Cash data={data} onRefresh={() => refresh()} /> : null}
              </>
            )}
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            borderTopWidth: 1,
            borderColor: c.line,
            backgroundColor: c.white,
          }}
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: current === id }}
              onPress={() => {
                setTab(id);
                setMessage("");
              }}
              style={{
                flex: 1,
                minHeight: 68,
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderTopWidth: 3,
                borderTopColor: current === id ? c.lime : "transparent",
              }}
            >
              <Icon size={22} color={current === id ? c.ink : c.muted} />
              <Text
                style={{
                  color: current === id ? c.ink : c.muted,
                  fontWeight: "600",
                  fontSize: 12,
                }}
              >
                {label}
                {id === "orders" &&
                data?.orders.some((o) => o.status === "pending")
                  ? " (" +
                    data.orders.filter((o) => o.status === "pending").length +
                    ")"
                  : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {account && (
        <Sheet title="Mi cuenta" onClose={() => setAccount(false)}>
          <Label>{profile.full_name}</Label>
          <Label>{restaurant.name}</Label>
          <Label>{manager ? "Administrador / Cajero" : "Mesero"}</Label>
          {!manager && data?.waiterShift?.active ? (
            <>
              <Label muted>
                Turno abierto desde {new Date(data.waiterShift.openedAt || Date.now()).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </Label>
              <Notice error message={shiftError} />
              <Button title="Cerrar turno" icon={Clock3} secondary busy={shiftBusy} onPress={() => void setShift(false)} />
            </>
          ) : null}
          <Button
            title="Cambiar restaurante"
            icon={Store}
            secondary
            onPress={change}
          />
          <Button
            title="Cerrar sesion"
            icon={LogOut}
            secondary
            onPress={() => {
              void supabase?.auth.signOut({ scope: "local" });
            }}
          />
        </Sheet>
      )}
    </SafeAreaView>
  );
}
