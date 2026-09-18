import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  Ban,
  Bike,
  Check,
  Clock3,
  Eye,
  ImagePlus,
  Printer,
  RefreshCw,
  type LucideIcon,
} from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import type { Order, Payment, Receipt, Snapshot } from "@/lib/types";
import { Button, c, Empty, Field, Label, Money, Notice, s, Sheet } from "./ui";
import { paymentLabels, Payments } from "./Sale";
import { ReceiptPicker } from "./ReceiptPicker";
import { ReceiptViewer } from "./ReceiptViewer";
export const statusLabels = {
  pending: "Nuevo",
  accepted: "Aceptado",
  preparing: "En cocina",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
const colors = {
  pending: "#926500",
  accepted: "#246D85",
  preparing: "#246D85",
  ready: "#18704D",
  delivered: "#647182",
  cancelled: "#B33040",
};
export function Orders({
  data,
  onRefresh,
  onPrint,
  printing = false,
}: {
  data: Snapshot;
  onRefresh: () => Promise<void>;
  onPrint: (order: Order) => Promise<boolean>;
  printing?: boolean;
}) {
  const [filter, setFilter] = useState("active"),
    [selected, setSelected] = useState<string | null>(null);
  const [quickBusy, setQuickBusy] = useState<string | null>(null),
    [quickError, setQuickError] = useState(""),
    [quickMessage, setQuickMessage] = useState("");
  async function quickMutate(order: Order, action: string, payload: Record<string, unknown>) {
    if (quickBusy) return;
    setQuickBusy(`${order.id}:${action}`);
    setQuickError("");
    setQuickMessage("");
    try {
      const result = await api<{ status?: string }>("", {
        restaurantId: data.restaurant.id,
        orderId: order.id,
        action,
        ...payload,
      });
      if (action === "dispatch-rider" && result.status === "manual_fallback") {
        setQuickMessage("No hay riders disponibles. Puedes asignarlo desde el detalle.");
      } else if (action === "dispatch-rider") {
        setQuickMessage(`Se esta buscando rider para ${order.order_number}.`);
      } else if (action === "eta") {
        setQuickMessage(`Tiempo de ${order.order_number} actualizado para el cliente.`);
      } else if (action === "charge") {
        setQuickMessage(`${order.order_number} cobrado.`);
      } else {
        setQuickMessage(`${order.order_number} actualizado.`);
      }
      await onRefresh();
    } catch (error) {
      setQuickError(errorMessage(error));
    } finally {
      setQuickBusy(null);
    }
  }
  const orders = data.orders.filter(
    (o) =>
      filter === "all" ||
      (filter === "active"
        ? !["delivered", "cancelled"].includes(o.status)
        : filter === "unpaid"
          ? o.payment_status === "pending" && o.status !== "cancelled"
          : o.status === filter),
  );
  const order = data.orders.find((o) => o.id === selected);
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            { id: "active", name: "En curso" },
            { id: "pending", name: "Nuevos" },
            { id: "ready", name: "Listos" },
            { id: "unpaid", name: "Sin cobrar" },
            { id: "all", name: "Recientes" },
          ].map((f) => (
            <Button
              key={f.id}
              title={f.name}
              secondary={filter !== f.id}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </ScrollView>
        <Notice error message={quickError} />
        <Notice message={quickMessage} />
        {orders.map((o) => {
          const prepMinutes = Math.max(
            0,
            ...o.order_items.map((item) => Number(item.prep_minutes || 0)),
          );
          const estimatedMinutes = Math.max(
            1,
            prepMinutes + Number(o.eta_adjustment_minutes || 0) || 15,
          );
          const assignment = data.deliveryAssignments?.find(
            (item) => item.order_id === o.id,
          );
          const nextStatus =
            o.status === "accepted"
              ? "preparing"
              : o.status === "preparing"
                ? "ready"
                : o.status === "ready" && o.order_type !== "delivery"
                  ? "delivered"
                  : null;
          const busy = quickBusy?.startsWith(`${o.id}:`) || false;
          return (
            <View
              key={o.id}
              style={{
                backgroundColor: c.white,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Ver pedido " + o.order_number}
                onPress={() => setSelected(o.id)}
                style={({ pressed }) => ({
                  padding: 16,
                  gap: 10,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <View style={s.between}>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: c.ink,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    {o.order_number.startsWith("POS-")
                      ? "POS-" + o.order_number.slice(4, 12).toUpperCase()
                      : o.order_number}
                  </Text>
                  <Text
                    style={{
                      color: colors[o.status],
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {statusLabels[o.status]}
                  </Text>
                </View>
                <Label>
                  {data.tables.find((t) => t.id === o.table_id)?.name ||
                    (o.order_type === "delivery" ? "Delivery" : "Mostrador")}{" "}
                  · {o.customer_name || "Cliente"}
                </Label>
                <Label muted>
                  {o.order_items
                    .map((i) => i.quantity + " " + i.product_name)
                    .join(", ")}
                </Label>
                <View style={s.between}>
                  <Text style={{ color: c.muted, fontSize: 12, flex: 1 }}>
                    {new Date(o.created_at).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {o.payment_status === "paid" ? "Pagado" : "Pendiente de pago"}
                    {![
                      "ready",
                      "delivered",
                      "cancelled",
                    ].includes(o.status)
                      ? ` · ${estimatedMinutes} min`
                      : ""}
                  </Text>
                  <Money value={o.total} currency={data.settings.currency} />
                </View>
                {Boolean(o.payment_receipt_url) && o.payment_status !== "paid" && (
                  <Text style={s.badge}>Comprobante adjunto</Text>
                )}
              </Pressable>
              <View
                style={{
                  borderTopWidth: 1,
                  borderColor: c.line,
                  padding: 10,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <QuickAction
                  title="Abrir"
                  icon={Eye}
                  disabled={busy}
                  onPress={() => setSelected(o.id)}
                />
                {data.restaurant.canManage &&
                  o.status === "pending" && (
                    <QuickAction
                      title="Aceptar"
                      icon={Check}
                      primary
                      disabled={busy}
                      onPress={() => void quickMutate(o, "accept", {})}
                    />
                  )}
                {data.restaurant.canManage &&
                  o.payment_status === "pending" &&
                  !["delivered", "cancelled"].includes(o.status) && (
                    <QuickAction
                      title="Cobrar"
                      icon={Check}
                      disabled={busy || !data.cashOpen}
                      onPress={() =>
                        void quickMutate(o, "charge", {
                          paymentMethod: o.payment_method,
                          reference: o.payment_receipt_reference || "",
                        })
                      }
                    />
                  )}
                {data.restaurant.canManage && nextStatus && (
                  <QuickAction
                    title={
                      nextStatus === "preparing"
                        ? "A cocina"
                        : nextStatus === "ready"
                          ? "Marcar listo"
                          : "Entregado"
                    }
                    icon={Check}
                    primary
                    disabled={busy}
                    onPress={() =>
                      void quickMutate(o, "status", {
                        expected: o.status,
                        next: nextStatus,
                      })
                    }
                  />
                )}
                {data.restaurant.canManage &&
                  ["pending", "accepted", "preparing"].includes(o.status) && (
                    <QuickAction
                      title="+5 min"
                      icon={Clock3}
                      disabled={busy}
                      onPress={() =>
                        void quickMutate(o, "eta", {
                          adjustmentMinutes: Math.min(
                            180,
                            Number(o.eta_adjustment_minutes || 0) + 5,
                          ),
                        })
                      }
                    />
                  )}
                {data.restaurant.canManage &&
                  o.order_type === "delivery" &&
                  o.status === "ready" &&
                  !assignment && (
                    <QuickAction
                      title="Llamar moto"
                      icon={Bike}
                      primary
                      disabled={busy}
                      onPress={() => void quickMutate(o, "dispatch-rider", {})}
                    />
                  )}
                <QuickAction
                  title="Reimprimir"
                  icon={Printer}
                  disabled={busy || printing}
                  onPress={() => void onPrint(o)}
                />
              </View>
            </View>
          );
        })}
        {!orders.length && <Empty title="Sin pedidos en esta vista" />}
      </ScrollView>
      {order && (
        <OrderDetail
          key={order.id}
          order={order}
          data={data}
          onClose={() => setSelected(null)}
          onRefresh={onRefresh}
          onPrint={onPrint}
          printing={printing}
        />
      )}
    </>
  );
}

function QuickAction({
  title,
  icon: Icon,
  onPress,
  disabled = false,
  primary = false,
}: {
  title: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: 12,
        borderRadius: 7,
        borderWidth: primary ? 0 : 1,
        borderColor: c.line,
        backgroundColor: primary ? c.lime : c.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        opacity: disabled ? 0.42 : pressed ? 0.72 : 1,
      })}
    >
      <Icon size={17} color={c.ink} />
      <Text style={{ color: c.ink, fontWeight: "700", fontSize: 12 }}>
        {title}
      </Text>
    </Pressable>
  );
}

function OrderDetail({
  order,
  data,
  onClose,
  onRefresh,
  onPrint,
  printing,
}: {
  order: Order;
  data: Snapshot;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onPrint: (order: Order) => Promise<boolean>;
  printing: boolean;
}) {
  const [payment, setPayment] = useState<Payment>(order.payment_method),
    [reference, setReference] = useState(order.payment_receipt_reference || ""),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [cancelReason, setCancelReason] = useState(""),
    [riderSearch, setRiderSearch] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [receiptUrl, setReceiptUrl] = useState("");
  async function mutate(payload: unknown, withReceipt = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ status?: string; riderName?: string }>(
        "",
        payload,
        withReceipt ? receipt : null,
      );
      setReceipt(null);
      const action =
        payload && typeof payload === "object" && "action" in payload
          ? String(payload.action)
          : "";
      if (action === "dispatch-rider" && result.status === "manual_fallback") {
        setMessage("No hay riders disponibles ahora. Puedes asignar uno manualmente.");
      } else if (action === "dispatch-rider" && result.status === "pending_offer") {
        setMessage("Solicitud enviada al siguiente rider disponible.");
      } else if (action === "assign-rider") {
        setMessage(result.riderName ? `Rider asignado: ${result.riderName}.` : "Rider asignado.");
      } else {
        setMessage("Pedido actualizado.");
      }
      await onRefresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function viewReceipt() {
    setError("");
    try {
      const result = await api<{ url: string }>(
        "?restaurantId=" + data.restaurant.id + "&receiptOrderId=" + order.id,
      );
      if (!result.url) throw new Error("Comprobante no disponible.");
      setReceiptUrl(result.url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const base = { restaurantId: data.restaurant.id, orderId: order.id };
  const prepMinutes = Math.max(0, ...order.order_items.map((item) => Number(item.prep_minutes || 0)));
  const adjustmentMinutes = Number(order.eta_adjustment_minutes || 0);
  const estimatedMinutes = prepMinutes + adjustmentMinutes;
  const assignment = data.deliveryAssignments?.find((item) => item.order_id === order.id);
  const assignedRider = data.riders?.find((item) => item.id === assignment?.restaurant_rider_id);
  const visibleRiders = (data.riders ?? [])
    .filter((rider) => {
      const query = riderSearch.trim().toLowerCase();
      return !query || rider.full_name.toLowerCase().includes(query) || rider.plate_number.toLowerCase().includes(query);
    })
    .slice(0, 6);
  const canCharge =
    data.restaurant.canManage &&
    order.payment_status === "pending" &&
    ["pending", "accepted", "preparing", "ready"].includes(order.status);
  const canAccept = data.restaurant.canManage && order.status === "pending";
  const next =
    order.status === "accepted"
      ? "preparing"
      : order.status === "preparing"
        ? "ready"
        : order.status === "ready" && order.order_type !== "delivery"
          ? "delivered"
          : null;
  return (
    <>
    <Sheet
      title="Detalle del pedido"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={s.between}>
        <Label>{order.customer_name}</Label>
        <Text style={s.badge}>{statusLabels[order.status]}</Text>
      </View>
      <Label>
        {data.tables.find((t) => t.id === order.table_id)?.name ||
          order.order_type}
      </Label>
      {Boolean(order.notes) && <Label muted>{order.notes}</Label>}
      {order.order_items.map((i) => (
        <View key={i.id} style={{ gap: 6 }}>
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Label>
                {i.quantity} × {i.product_name}
              </Label>
            </View>
            <Money value={i.subtotal} currency={data.settings.currency} />
          </View>
          {Boolean(i.notes) && <Label muted>{i.notes}</Label>}
        </View>
      ))}
      {!["ready", "delivered", "cancelled"].includes(order.status) && (
        <View style={{ borderRadius: 8, backgroundColor: "#EEF5FA", padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Clock3 size={19} color={c.ink} />
            <Label>Tiempo estimado</Label>
          </View>
          <Text style={{ color: c.ink, fontSize: 34, lineHeight: 40, fontWeight: "800" }}>
            {estimatedMinutes || 15} min
          </Text>
          {adjustmentMinutes > 0 && <Label muted>Incluye {adjustmentMinutes} min adicionales informados al cliente.</Label>}
          {data.restaurant.canManage && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                title="+5 min"
                secondary
                busy={busy}
                onPress={() => void mutate({ ...base, action: "eta", adjustmentMinutes: Math.min(180, adjustmentMinutes + 5) })}
              />
              <Button
                title="+10 min"
                secondary
                busy={busy}
                onPress={() => void mutate({ ...base, action: "eta", adjustmentMinutes: Math.min(180, adjustmentMinutes + 10) })}
              />
              {adjustmentMinutes > 0 && (
                <Button
                  title="Restablecer"
                  secondary
                  busy={busy}
                  onPress={() => void mutate({ ...base, action: "eta", adjustmentMinutes: 0 })}
                />
              )}
            </View>
          )}
        </View>
      )}
      <View style={s.divider} />
      <View style={s.between}>
        <Label>Total · {paymentLabels[order.payment_method]}</Label>
        <Money large value={order.total} currency={data.settings.currency} />
      </View>
      <Label>
        {order.payment_status === "paid" ? "Pago aprobado" : "Pago pendiente"}
      </Label>
      <Button
        title="Reimprimir ticket"
        icon={Printer}
        secondary
        busy={printing}
        disabled={busy}
        onPress={() => void onPrint(order)}
      />
      {Boolean(order.payment_receipt_url) && (
        <Button
          title="Ver comprobante"
          icon={ImagePlus}
          secondary
          onPress={() => void viewReceipt()}
        />
      )}
      {order.payment_status === "pending" && order.status !== "cancelled" && (
        <>
          <ReceiptPicker
            value={receipt}
            onChange={setReceipt}
            disabled={busy}
          />
          {receipt && (
            <Button
              title="Adjuntar comprobante"
              icon={ImagePlus}
              busy={busy}
              onPress={() => void mutate({ ...base, action: "receipt" }, true)}
            />
          )}
        </>
      )}
      {canCharge && (
        <>
          <Payments value={payment} onChange={setPayment} disabled={busy} />
          <Field
            label="Referencia de pago"
            value={reference}
            onChangeText={setReference}
            maxLength={160}
          />
          <Button
            title="Aprobar pago y cobrar"
            icon={Check}
            busy={busy}
            disabled={!data.cashOpen}
            onPress={() =>
              void mutate(
                {
                  ...base,
                  action: "charge",
                  paymentMethod: payment,
                  reference,
                },
                true,
              )
            }
          />
        </>
      )}
      {canAccept && (
        <Button
          title="Aceptar pedido"
          icon={Check}
          busy={busy}
          onPress={() => void mutate({ ...base, action: "accept" })}
        />
      )}
      {data.restaurant.canManage && next && (
        <Button
          title={
            next === "preparing"
              ? "Enviar a cocina"
              : next === "ready"
                ? "Marcar listo"
                : "Marcar entregado"
          }
          icon={Check}
          secondary
          busy={busy}
          onPress={() =>
            void mutate({
              ...base,
              action: "status",
              expected: order.status,
              next,
            })
          }
        />
      )}
      {data.restaurant.canManage && order.order_type === "delivery" ? (
        <View style={{ gap: 12, borderTopWidth: 1, borderColor: c.line, paddingTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Bike size={20} color={c.ink} />
            <Label>Despacho rider</Label>
          </View>
          {assignment ? (
            <View style={{ borderRadius: 8, backgroundColor: "#EDF7F1", padding: 14, gap: 5 }}>
              <Label>{assignment.delivery_name || assignedRider?.full_name || "Rider asignado"}</Label>
              <Label muted>{assignedRider?.plate_number || assignment.delivery_phone || assignment.status}</Label>
              {assignment.pickup_confirmation_code ? (
                <View style={{ marginTop: 6 }}>
                  <Label muted>Código de retiro</Label>
                  <Text selectable style={{ color: c.ink, fontSize: 30, fontWeight: "800", letterSpacing: 0 }}>
                    {assignment.pickup_confirmation_code}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : order.status === "ready" ? (
            <>
              <Button
                title="Buscar rider automáticamente"
                icon={Bike}
                busy={busy}
                onPress={() => void mutate({ ...base, action: "dispatch-rider" })}
              />
              <Field
                label="Buscar rider por nombre o placa"
                value={riderSearch}
                onChangeText={setRiderSearch}
              />
              {visibleRiders.map((rider) => (
                <Button
                  key={rider.id}
                  title={rider.full_name + " · " + rider.plate_number}
                  secondary
                  busy={busy}
                  onPress={() => void mutate({ ...base, action: "assign-rider", riderId: rider.id })}
                />
              ))}
              {!visibleRiders.length && <Label muted>No hay riders activos que coincidan.</Label>}
            </>
          ) : (
            <Label muted>El pedido debe estar listo antes de buscar o asignar un rider.</Label>
          )}
        </View>
      ) : null}
      {data.restaurant.canManage && !["delivered", "cancelled"].includes(order.status) ? (
        <View style={{ gap: 10, borderTopWidth: 1, borderColor: c.line, paddingTop: 16 }}>
          <Field
            label="Motivo de anulacion o correccion"
            multiline
            maxLength={500}
            value={cancelReason}
            onChangeText={setCancelReason}
          />
          <Button
            title={order.payment_status === "paid" ? "Anular y registrar reembolso" : "Anular comanda"}
            icon={Ban}
            secondary
            busy={busy}
            disabled={cancelReason.trim().length < 5}
            onPress={() => void mutate({ ...base, action: "cancel-order", reason: cancelReason.trim() })}
          />
          <Label muted>La anulacion no se borra: quedara pendiente de revision para el dueno.</Label>
        </View>
      ) : null}
      <Notice error message={error} />
      <Notice message={message} />
      <Button
        title="Actualizar pedido"
        icon={RefreshCw}
        secondary
        disabled={busy}
        onPress={() => void onRefresh()}
      />
    </Sheet>
    {receiptUrl ? <ReceiptViewer uri={receiptUrl} onClose={() => setReceiptUrl("")} /> : null}
    </>
  );
}
