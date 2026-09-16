import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Check, LockKeyhole, UnlockKeyhole } from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { cashTotals, parseAmount } from "@/lib/domain";
import type { Snapshot } from "@/lib/types";
import {
  Button,
  Empty,
  Field,
  Label,
  Money,
  Notice,
  s,
  Sheet,
  Title,
} from "./ui";
export function Cash({
  data,
  onRefresh,
}: {
  data: Snapshot;
  onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState<"open" | "close" | null>(null),
    [amount, setAmount] = useState(""),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const totals = cashTotals(
    data.cashSession?.opening_amount || 0,
    data.movements,
  );
  async function submit() {
    if (busy) return;
    setError("");
    try {
      const value = parseAmount(amount);
      if (!confirm) {
        setConfirm(true);
        return;
      }
      setBusy(true);
      const result = await api<unknown>("", {
        restaurantId: data.restaurant.id,
        action: form === "open" ? "open-cash" : "close-cash",
        sessionId: data.cashSession?.id,
        amount: value,
        notes,
      });
      const closed = Array.isArray(result)
        ? (result[0] as { difference_amount?: number })
        : null;
      setMessage(
        form === "open"
          ? "Caja abierta."
          : "Caja cerrada. Diferencia: " +
              Number(closed?.difference_amount || 0).toFixed(2),
      );
      setForm(null);
      setConfirm(false);
      setAmount("");
      setNotes("");
      await onRefresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ScrollView contentContainerStyle={s.section}>
        <Title>Caja del turno</Title>
        <Notice message={message} />
        {data.cashSession ? (
          <>
            <Label>
              Abierta desde{" "}
              {new Date(data.cashSession.opened_at).toLocaleString("es")}
            </Label>
            <View style={s.between}>
              <Label>Fondo inicial</Label>
              <Money
                value={data.cashSession.opening_amount}
                currency={data.settings.currency}
              />
            </View>
            <View style={s.between}>
              <Label>Ventas del turno</Label>
              <Money value={totals.sales} currency={data.settings.currency} />
            </View>
            <View style={s.between}>
              <Label>Pagos digitales</Label>
              <Money value={totals.digital} currency={data.settings.currency} />
            </View>
            <View style={s.divider} />
            <Label>Efectivo esperado</Label>
            <Money
              large
              value={totals.expected}
              currency={data.settings.currency}
            />
            <Button
              title="Cerrar caja"
              icon={LockKeyhole}
              secondary
              onPress={() => {
                setError("");
                setConfirm(false);
                setForm("close");
              }}
            />
            <Title>Movimientos</Title>
            {data.movements.map((m) => (
              <View
                key={m.id}
                style={[
                  s.between,
                  {
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderColor: "#DCE2E8",
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Label>{m.description}</Label>
                  <Label muted>
                    {m.payment_method} ·{" "}
                    {new Date(m.created_at).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Label>
                </View>
                <Money value={m.amount} currency={data.settings.currency} />
              </View>
            ))}
          </>
        ) : (
          <Empty
            title="Caja cerrada"
            action={
              <Button
                title="Abrir caja"
                icon={UnlockKeyhole}
                onPress={() => {
                  setError("");
                  setConfirm(false);
                  setForm("open");
                }}
              />
            }
          />
        )}
      </ScrollView>
      {form && (
        <Sheet
          title={form === "open" ? "Apertura de caja" : "Cierre de caja"}
          onClose={() => {
            if (!busy) {
              setForm(null);
              setConfirm(false);
            }
          }}
          footer={
            <Button
              title={
                confirm
                  ? "Confirmar " + (form === "open" ? "apertura" : "cierre")
                  : "Revisar monto"
              }
              icon={Check}
              busy={busy}
              onPress={() => void submit()}
            />
          }
        >
          <Field
            label={form === "open" ? "Fondo inicial" : "Efectivo contado"}
            keyboardType="decimal-pad"
            value={amount}
            editable={!busy}
            onChangeText={(value) => {
              setAmount(value);
              setConfirm(false);
            }}
          />
          <Field
            label="Observaciones"
            multiline
            value={notes}
            editable={!busy}
            maxLength={500}
            onChangeText={setNotes}
          />
          {confirm && (
            <>
              <Label>
                {form === "open" ? "Fondo a registrar" : "Efectivo contado"}
              </Label>
              <Money
                large
                value={parseAmount(amount)}
                currency={data.settings.currency}
              />
              {form === "close" && (
                <Label>
                  Diferencia:{" "}
                  {(parseAmount(amount) - totals.expected).toFixed(2)}
                </Label>
              )}
            </>
          )}
          <Notice error message={error} />
        </Sheet>
      )}
    </>
  );
}
