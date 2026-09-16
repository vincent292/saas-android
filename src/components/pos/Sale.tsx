import { useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { randomUUID } from "expo-crypto";
import {
  Check,
  Coffee,
  CupSoda,
  Drumstick,
  IceCreamBowl,
  Minus,
  Pizza,
  Plus,
  ReceiptText,
  ScanLine,
  ShoppingBag,
  ShoppingCart,
  Sandwich,
  UtensilsCrossed,
  X,
} from "lucide-react-native";
import { api, ApiError, errorMessage } from "@/lib/api";
import { usePosDraftStore } from "@/store/pos-draft";
import type {
  CartLine,
  Order,
  Payment,
  Product,
  Receipt,
  Snapshot,
  Table,
} from "@/lib/types";
import {
  Button,
  c,
  Empty,
  Field,
  IconButton,
  Label,
  Money,
  Notice,
  s,
  Sheet,
  Title,
} from "./ui";
import { Scanner } from "./Scanner";
import { ReceiptPicker } from "./ReceiptPicker";
export const paymentLabels: Record<Payment, string> = {
  cash: "Efectivo",
  qr: "QR",
  bank_transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};
export function Payments({
  value,
  onChange,
  disabled,
}: {
  value: Payment;
  onChange: (value: Payment) => void;
  disabled?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
    >
      {(Object.keys(paymentLabels) as Payment[]).map((p) => (
        <Pressable
          key={p}
          accessibilityRole="radio"
          accessibilityState={{ checked: p === value }}
          disabled={disabled}
          onPress={() => onChange(p)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: p === value ? c.ink : c.line,
            backgroundColor: p === value ? c.ink : c.white,
            borderRadius: 6,
          }}
        >
          <Text
            style={{ color: p === value ? c.white : c.ink, fontWeight: "600" }}
          >
            {paymentLabels[p]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Sale({
  data,
  onRefresh,
  onSent,
}: {
  data: Snapshot;
  onRefresh: () => Promise<void>;
  onSent: (message: string) => void;
}) {
  const restaurantId = data.restaurant.id;
  const draft = usePosDraftStore((state) => state.drafts[restaurantId]);
  const storeSetCart = usePosDraftStore((state) => state.setCart);
  const storeSetMode = usePosDraftStore((state) => state.setMode);
  const storeSetTableId = usePosDraftStore((state) => state.setTableId);
  const mode = data.restaurant.canManage ? (draft?.mode ?? "pos") : "table";
  const cart = draft?.cart ?? [];
  const table = data.tables.find((item) => item.id === draft?.tableId) ?? null;
  const setCart = (update: CartLine[] | ((cart: CartLine[]) => CartLine[])) =>
    storeSetCart(restaurantId, update);
  const setMode = (next: "pos" | "table") => storeSetMode(restaurantId, next);
  const setTable = (next: Table | null) => storeSetTableId(restaurantId, next?.id ?? null);
  const [scan, setScan] = useState(false);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all");
  const [product, setProduct] = useState<Product | null>(null),
    [checkout, setCheckout] = useState(false),
    [settle, setSettle] = useState(false),
    [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const { width } = useWindowDimensions();
  const columns = width >= 950 ? 4 : width >= 650 ? 3 : 2;
  const products = data.products.filter(
    (p) =>
      (category === "all" || p.category_id === category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const count = cart.reduce((sum, l) => sum + l.quantity, 0),
    total = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const tableOrders = table
    ? data.orders.filter(
        (order) => order.table_id === table.id && !["delivered", "cancelled"].includes(order.status),
      )
    : [];
  function add(line: CartLine) {
    setCart((old) => [...old, line]);
    setProduct(null);
  }
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 18, gap: 16 }}
      >
        <View style={s.between}>
          <Title>Nuevo pedido</Title>
          <Text style={s.badge}>
            {data.cashOpen ? "Caja abierta" : "Caja cerrada"}
          </Text>
        </View>
        {!data.cashOpen && (
          <Notice
            error
            message="La caja debe estar abierta para enviar pedidos."
          />
        )}
        {data.restaurant.canManage && (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Button
                title="Mostrador"
                icon={ShoppingBag}
                disabled={pending}
                secondary={mode !== "pos"}
                onPress={() => {
                  setMode("pos");
                  setTable(null);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Mesa"
                disabled={pending}
                icon={UtensilsCrossed}
                secondary={mode !== "table"}
                onPress={() => setMode("table")}
              />
            </View>
          </View>
        )}
        {mode === "table" && (
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Label>
                {table ? table.name + " · " + table.code : "Sin mesa asignada"}
              </Label>
            </View>
            <Button
              title={table ? "Cambiar" : "Escanear mesa"}
              disabled={pending}
              icon={ScanLine}
              onPress={() => setScan(true)}
              secondary
            />
          </View>
        )}
        {mode === "table" && table ? (
          <TableAccount
            data={data}
            orders={tableOrders}
            table={table}
            onSettle={data.restaurant.canManage ? () => setSettle(true) : undefined}
          />
        ) : null}
        <Field
          label="Buscar producto"
          placeholder="Nombre del producto"
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {[{ id: "all", name: "Todos" }, ...data.categories].map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: category === item.id }}
              onPress={() => setCategory(item.id)}
              style={{
                padding: 12,
                borderBottomWidth: 3,
                borderBottomColor:
                  category === item.id ? c.lime : "transparent",
              }}
            >
              <Text
                style={{
                  color: category === item.id ? c.ink : c.muted,
                  fontWeight: "600",
                }}
              >
                {item.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Notice message={error} error />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {products.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={"Agregar " + p.name}
              disabled={pending}
              onPress={() => setProduct(p)}
              style={{
                width: (100 / columns - 3 + "%") as `${number}%`,
                flexGrow: 0,
                backgroundColor: c.white,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {p.image_url ? (
                <Image
                  source={{ uri: p.image_url }}
                  style={{ width: "100%", aspectRatio: 1.45 }}
                  resizeMode="cover"
                />
              ) : (
                <ProductPlaceholder
                  category={data.categories.find((item) => item.id === p.category_id)?.name ?? ""}
                  name={p.name}
                />
              )}
              <View style={{ padding: 12, gap: 8 }}>
                <Text
                  numberOfLines={2}
                  style={{
                    minHeight: 40,
                    fontSize: 14,
                    lineHeight: 20,
                    fontWeight: "600",
                    color: c.ink,
                  }}
                >
                  {p.name}
                </Text>
                <View style={s.between}>
                  <Money value={p.price} currency={data.settings.currency} />
                  <Plus size={18} color={c.ink} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
        {!products.length && (
          <Empty
            title="Sin productos"
            detail={
              search ? "No hay coincidencias." : "No hay productos disponibles."
            }
          />
        )}
      </ScrollView>
      <View style={[s.footer, { backgroundColor: c.white }]}>
        <Button
          title={
            "Ver pedido (" +
            count +
            ") · " +
            (data.settings.currency === "BOB"
              ? "Bs "
              : data.settings.currency + " ") +
            total.toFixed(2)
          }
          icon={ShoppingCart}
          disabled={!cart.length}
          onPress={() => {
            if (mode === "table" && !table) {
              setScan(true);
              return;
            }
            setCheckout(true);
          }}
        />
      </View>
      {scan && (
        <Scanner
          tables={data.tables}
          slug={data.restaurant.slug}
          onClose={() => setScan(false)}
          onTable={(next) => {
            setTable(next);
            setScan(false);
            setError("");
          }}
        />
      )}
      {product && (
        <Configure
          product={product}
          data={data}
          onClose={() => setProduct(null)}
          onAdd={add}
        />
      )}
      {settle && table ? (
        <SettleTable
          data={data}
          orders={tableOrders}
          table={table}
          onClose={() => setSettle(false)}
          onDone={(nextMessage) => {
            setSettle(false);
            setTable(null);
            onSent(nextMessage);
            void onRefresh();
          }}
        />
      ) : null}
      {cart.length > 0 && (mode === "pos" || table) && (
        <Checkout
          visible={checkout}
          onPending={setPending}
          key={mode + (table?.id || "")}
          data={data}
          table={mode === "table" ? table : null}
          cart={cart}
          setCart={setCart}
          onClose={() => setCheckout(false)}
          onDone={(message) => {
            setPending(false);
            setCheckout(false);
            setCart([]);
            if (mode === "pos") setTable(null);
            onSent(message);
            void onRefresh();
          }}
        />
      )}
    </View>
  );
}

function ProductPlaceholder({ category, name }: { category: string; name: string }) {
  const value = (category + " " + name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let Icon = UtensilsCrossed;
  let backgroundColor = "#E9EEF2";
  let color = c.muted;

  if (/cafe|capuccino|latte|te\b/.test(value)) {
    Icon = Coffee;
    backgroundColor = "#F1E8DD";
    color = "#795548";
  } else if (/refresco|bebida|gaseosa|agua|jugo|limonada/.test(value)) {
    Icon = CupSoda;
    backgroundColor = "#E3F4F7";
    color = "#18738A";
  } else if (/pizza/.test(value)) {
    Icon = Pizza;
    backgroundColor = "#FFF0D9";
    color = "#B85C20";
  } else if (/hamburg|sandwich|burger/.test(value)) {
    Icon = Sandwich;
    backgroundColor = "#F7E9D5";
    color = "#8C542B";
  } else if (/pollo|alita|carne/.test(value)) {
    Icon = Drumstick;
    backgroundColor = "#FBE8E4";
    color = "#A84335";
  } else if (/helado|postre|dulce/.test(value)) {
    Icon = IceCreamBowl;
    backgroundColor = "#F3E8F5";
    color = "#80508A";
  }

  return (
    <View style={{ width: "100%", aspectRatio: 1.45, backgroundColor, alignItems: "center", justifyContent: "center" }}>
      <Icon size={38} color={color} strokeWidth={1.8} />
    </View>
  );
}

function waiterName(notes: string) {
  return notes.match(/Mesero:\s*([^|]+)/i)?.[1]?.trim() || "Personal";
}

function waiterUser(notes: string) {
  return notes.match(/Usuario:\s*([a-f0-9-]+)/i)?.[1]?.slice(0, 8) || "sin ID";
}

function TableAccount({
  data,
  orders,
  table,
  onSettle,
}: {
  data: Snapshot;
  orders: Order[];
  table: Table;
  onSettle?: () => void;
}) {
  const total = orders.reduce((sum, order) => sum + Number(order.total), 0);
  return (
    <View style={{ backgroundColor: c.white, borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 15, gap: 12 }}>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Label>Consumo activo de {table.name}</Label>
          <Label muted>{orders.length ? `${orders.length} comanda${orders.length === 1 ? "" : "s"}` : "Sin pedidos activos"}</Label>
        </View>
        <Money value={total} currency={data.settings.currency} />
      </View>
      {orders.map((order) => (
        <View key={order.id} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 10, gap: 4 }}>
          <View style={s.between}>
            <Label>{order.order_number}</Label>
            <Money value={order.total} currency={data.settings.currency} />
          </View>
          <Label muted>{waiterName(order.notes)} | Usuario {waiterUser(order.notes)} | {new Date(order.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</Label>
          <Label muted>{order.order_items.map((item) => `${item.quantity} ${item.product_name}`).join(", ")}</Label>
        </View>
      ))}
      {onSettle && orders.length ? (
        <Button title="Cobrar cuenta completa" icon={ReceiptText} disabled={!data.cashOpen} onPress={onSettle} />
      ) : null}
    </View>
  );
}

function SettleTable({
  data,
  orders,
  table,
  onClose,
  onDone,
}: {
  data: Snapshot;
  orders: Order[];
  table: Table;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [payment, setPayment] = useState<Payment>("cash"),
    [reference, setReference] = useState(""),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const total = orders.reduce((sum, order) => sum + Number(order.total), 0);
  async function submit() {
    if (busy) return;
    const needsProof = orders.some((order) => order.payment_status === "pending" && !order.payment_receipt_url);
    if (payment === "qr" && needsProof && !receipt && !reference.trim()) {
      setError("Adjunta el comprobante o ingresa la referencia del pago.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(
        "",
        {
          restaurantId: data.restaurant.id,
          action: "settle-table",
          tableId: table.id,
          paymentMethod: payment,
          reference,
        },
        receipt,
      );
      onDone(`${table.name} cobrada y liberada.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={`Cobrar ${table.name}`}
      onClose={() => { if (!busy) onClose(); }}
      footer={
        <>
          <Notice error message={error} />
          <Button title="Cobrar todo y liberar mesa" icon={Check} busy={busy} disabled={!orders.length || !data.cashOpen} onPress={() => void submit()} />
        </>
      }
    >
      <View style={s.between}>
        <Label>{orders.length} comandas activas</Label>
        <Money large value={total} currency={data.settings.currency} />
      </View>
      <Payments value={payment} onChange={setPayment} disabled={busy} />
      {payment === "qr" && data.settings.qr_payment_url ? (
        <Image source={{ uri: data.settings.qr_payment_url }} style={{ width: "100%", height: 260 }} resizeMode="contain" />
      ) : null}
      <Field label="Referencia de pago" value={reference} onChangeText={setReference} editable={!busy} maxLength={160} />
      <Label>Comprobante</Label>
      <ReceiptPicker value={receipt} onChange={setReceipt} disabled={busy} />
    </Sheet>
  );
}

function Configure({
  product,
  data,
  onClose,
  onAdd,
}: {
  product: Product;
  data: Snapshot;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const variants = data.variants.filter((v) => v.product_id === product.id),
    groups = data.groups.filter((g) => g.product_id === product.id);
  const [variant, setVariant] = useState(
      variants.length === 1 ? variants[0].id : "",
    ),
    [options, setOptions] = useState<string[]>([]),
    [quantity, setQuantity] = useState(1),
    [notes, setNotes] = useState(""),
    [error, setError] = useState("");
  const selected = data.options.filter((o) => options.includes(o.id));
  const price =
    Number(product.price) +
    Number(variants.find((v) => v.id === variant)?.price_delta || 0) +
    selected.reduce((sum, o) => sum + Number(o.price_delta), 0);
  function add() {
    if (variants.length && !variant) {
      setError("Selecciona una variante.");
      return;
    }
    for (const group of groups) {
      const n = selected.filter((o) => o.option_group_id === group.id).length;
      if (
        n < Math.max(group.min_choices, group.is_required ? 1 : 0) ||
        n > group.max_choices
      ) {
        setError("Revisa las opciones de " + group.name + ".");
        return;
      }
    }
    onAdd({
      key: randomUUID(),
      productId: product.id,
      variantId: variant || undefined,
      optionIds: options,
      name:
        product.name +
        (variant ? " · " + variants.find((v) => v.id === variant)?.name : ""),
      price,
      quantity,
      notes: [selected.map((o) => o.name).join(", "), notes]
        .filter(Boolean)
        .join(" | "),
    });
  }
  return (
    <Sheet
      title={product.name}
      onClose={onClose}
      footer={<Button title="Agregar al pedido" icon={Plus} onPress={add} />}
    >
      <Label muted>{product.description}</Label>
      {variants.length > 0 && (
        <View style={{ gap: 8 }}>
          <Label>Presentacion</Label>
          {variants.map((v) => (
            <Button
              key={v.id}
              title={v.name + " (+ " + Number(v.price_delta).toFixed(2) + ")"}
              secondary={variant !== v.id}
              icon={variant === v.id ? Check : undefined}
              onPress={() => setVariant(v.id)}
            />
          ))}
        </View>
      )}
      {groups.map((g) => (
        <View key={g.id} style={{ gap: 10 }}>
          <Label>
            {g.name} · {g.is_required ? "Obligatorio" : "Opcional"} · Max.{" "}
            {g.max_choices}
          </Label>
          {data.options
            .filter((o) => o.option_group_id === g.id)
            .map((o) => (
              <Pressable
                key={o.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: options.includes(o.id) }}
                onPress={() =>
                  setOptions((old) =>
                    old.includes(o.id)
                      ? old.filter((id) => id !== o.id)
                      : g.max_choices === 1
                        ? [
                            ...old.filter(
                              (id) =>
                                !data.options.some(
                                  (other) =>
                                    other.id === id &&
                                    other.option_group_id === g.id,
                                ),
                            ),
                            o.id,
                          ]
                        : [...old, o.id],
                  )
                }
                style={[
                  s.between,
                  {
                    borderBottomWidth: 1,
                    borderColor: c.line,
                    paddingVertical: 13,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Label>
                    {o.name} (+ {Number(o.price_delta).toFixed(2)})
                  </Label>
                </View>
                <View
                  style={{
                    height: 24,
                    width: 24,
                    borderWidth: 1,
                    borderColor: c.ink,
                    backgroundColor: options.includes(o.id) ? c.lime : c.white,
                  }}
                >
                  {options.includes(o.id) && <Check size={21} color={c.ink} />}
                </View>
              </Pressable>
            ))}
        </View>
      ))}
      <Field
        label="Notas de cocina"
        multiline
        maxLength={350}
        value={notes}
        onChangeText={setNotes}
      />
      <View style={s.between}>
        <View style={s.row}>
          <IconButton
            icon={Minus}
            label="Reducir cantidad"
            disabled={quantity === 1}
            onPress={() => setQuantity((n) => n - 1)}
          />
          <Label>{quantity}</Label>
          <IconButton
            icon={Plus}
            label="Aumentar cantidad"
            disabled={quantity === 99}
            onPress={() => setQuantity((n) => n + 1)}
          />
        </View>
        <Money value={price * quantity} currency={data.settings.currency} />
      </View>
      <Notice error message={error} />
    </Sheet>
  );
}
function Checkout({
  visible,
  onPending,
  data,
  table,
  cart,
  setCart,
  onClose,
  onDone,
}: {
  visible: boolean;
  onPending: (pending: boolean) => void;
  data: Snapshot;
  table: Table | null;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [notes, setNotes] = useState(""),
    [reference, setReference] = useState("");
  const [payment, setPayment] = useState<Payment>("cash"),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(randomUUID()),
    lock = useRef(false);
  const attempt = useRef<{ payload: unknown; receipt: Receipt | null } | null>(
    null,
  );
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  async function submit() {
    if (lock.current) return;
    if (!cart.length || !data.cashOpen) {
      setError("Agrega productos y verifica que la caja este abierta.");
      return;
    }
    if (!table && !data.restaurant.canManage) {
      setError("Escanea una mesa antes de enviar.");
      return;
    }
    if (!table && payment === "qr" && !receipt && !reference.trim()) {
      setError("Adjunta el comprobante o ingresa la referencia.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    const payload = {
      restaurantId: data.restaurant.id,
      requestId: requestId.current,
      action: table ? "table-order" : "sale",
      tableCode: table?.code,
      customerName: name,
      customerPhone: phone,
      paymentMethod: payment,
      reference,
      notes,
      items: cart.map(
        ({ productId, variantId, optionIds, quantity, notes }) => ({
          productId,
          variantId,
          optionIds,
          quantity,
          notes,
        }),
      ),
    };
    attempt.current ??= { payload, receipt };
    onPending(true);
    try {
      const result = await api<{ order_number: string }>(
        "",
        attempt.current.payload,
        attempt.current.receipt,
      );
      onDone("Pedido " + result.order_number + " enviado.");
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        attempt.current = null;
        onPending(false);
      }
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const frozen = busy || Boolean(attempt.current);
  return (
    <Sheet
      title={table ? table.name : "Venta mostrador"}
      visible={visible}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Notice error message={error} />
          <Button
            title={
              attempt.current
                ? "Reintentar mismo pedido"
                : table
                  ? "Enviar pedido a caja"
                  : "Cobrar y enviar"
            }
            icon={Check}
            busy={busy}
            disabled={!cart.length || !data.cashOpen}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <Label muted>
        {table ? "Pedido de mesa · Pago pendiente de aprobacion" : "Venta POS"}
      </Label>
      {cart.map((line) => (
        <View
          key={line.key}
          style={{
            gap: 7,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderColor: c.line,
          }}
        >
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Label>{line.name}</Label>
            </View>
            <IconButton
              icon={X}
              label={"Quitar " + line.name}
              disabled={frozen}
              onPress={() =>
                setCart((old) => old.filter((i) => i.key !== line.key))
              }
            />
          </View>
          {line.notes ? <Label muted>{line.notes}</Label> : null}
          <View style={s.between}>
            <View style={s.row}>
              <IconButton
                icon={Minus}
                label="Reducir cantidad"
                disabled={frozen || line.quantity === 1}
                onPress={() =>
                  setCart((old) =>
                    old.map((i) =>
                      i.key === line.key
                        ? { ...i, quantity: i.quantity - 1 }
                        : i,
                    ),
                  )
                }
              />
              <Label>{line.quantity}</Label>
              <IconButton
                icon={Plus}
                label="Aumentar cantidad"
                disabled={frozen || line.quantity === 99}
                onPress={() =>
                  setCart((old) =>
                    old.map((i) =>
                      i.key === line.key
                        ? { ...i, quantity: i.quantity + 1 }
                        : i,
                    ),
                  )
                }
              />
            </View>
            <Money
              value={line.price * line.quantity}
              currency={data.settings.currency}
            />
          </View>
        </View>
      ))}
      <View style={s.between}>
        <Title>Total</Title>
        <Money large value={total} currency={data.settings.currency} />
      </View>
      <Field
        label="Nombre del cliente (opcional)"
        value={name}
        onChangeText={setName}
        editable={!frozen}
        maxLength={120}
      />
      <Field
        label="Telefono (opcional)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        editable={!frozen}
        maxLength={40}
      />
      <Payments value={payment} onChange={setPayment} disabled={frozen} />
      {payment === "qr" && data.settings.qr_payment_url && (
        <Image
          source={{ uri: data.settings.qr_payment_url }}
          style={{ width: "100%", height: 260 }}
          resizeMode="contain"
        />
      )}
      <Label>Comprobante</Label>
      <ReceiptPicker value={receipt} onChange={setReceipt} disabled={frozen} />
      {!table && (
        <Field
          label="Referencia de pago"
          value={reference}
          onChangeText={setReference}
          editable={!frozen}
          maxLength={160}
        />
      )}
      {table && (
        <Field
          label="Notas del pedido"
          multiline
          value={notes}
          onChangeText={setNotes}
          editable={!frozen}
          maxLength={500}
        />
      )}
    </Sheet>
  );
}
