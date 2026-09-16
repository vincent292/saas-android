import type { Movement, Table } from "./types";
export function tableFromQr(raw: string, slug: string, tables: Table[]): Table {
  let code = raw.trim();
  if (/^https?:\/\//i.test(code)) {
    const parts = new URL(code).pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const index = parts.indexOf("mesa");
    if (index < 1 || parts[index - 1] !== slug || parts.length !== index + 2)
      throw new Error("Este QR no corresponde a una mesa de este restaurante.");
    code = parts[index + 1];
  }
  const table = tables.find((t) => t.code.toUpperCase() === code.toUpperCase());
  if (!table) throw new Error("Mesa no encontrada en este restaurante.");
  return table;
}
export function cashTotals(opening: number, movements: Movement[]) {
  let expected = Number(opening),
    sales = 0,
    digital = 0;
  for (const m of movements) {
    const amount = Number(m.amount);
    if (m.type === "sale") {
      sales += amount;
      if (m.payment_method !== "cash") digital += amount;
    }
    if (m.payment_method !== "cash") continue;
    if (["sale", "income", "adjustment"].includes(m.type)) expected += amount;
    if (m.type === "expense") expected -= amount;
  }
  return { expected, sales, digital };
}
export function parseAmount(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
    throw new Error("Ingresa un monto valido, con hasta dos decimales.");
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount > 100000000)
    throw new Error("Monto fuera de rango.");
  return amount;
}
