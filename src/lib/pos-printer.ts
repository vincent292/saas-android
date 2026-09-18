import AsyncStorage from "@react-native-async-storage/async-storage";
import { PermissionsAndroid, Platform } from "react-native";
import type { IBLEPrinter, INetPrinter } from "react-native-earl-thermal-printer";
import type { Order, Snapshot } from "./types";

export type PrinterConnection =
  | {
      autoPrint: boolean;
      kind: "bluetooth";
      name: string;
      address: string;
      paperWidth: 32 | 48;
    }
  | {
      autoPrint: boolean;
      kind: "network";
      name: string;
      host: string;
      port: number;
      paperWidth: 32 | 48;
    };

export type PrinterCandidate =
  | { kind: "bluetooth"; name: string; address: string }
  | { kind: "network"; name: string; host: string; port: number };

const storageKey = (restaurantId: string) => `yopido:pos-printer:${restaurantId}`;

export async function readPrinterConnection(restaurantId: string) {
  const raw = await AsyncStorage.getItem(storageKey(restaurantId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PrinterConnection;
    if (value.kind === "bluetooth" && value.address) return value;
    if (value.kind === "network" && value.host && value.port) return value;
  } catch {
    // An invalid local preference should behave as if no printer was selected.
  }
  return null;
}

export async function savePrinterConnection(restaurantId: string, connection: PrinterConnection | null) {
  if (connection) {
    await AsyncStorage.setItem(storageKey(restaurantId), JSON.stringify(connection));
  } else {
    await AsyncStorage.removeItem(storageKey(restaurantId));
  }
}

async function printerModule() {
  if (Platform.OS === "web") throw new Error("La impresion termica directa no esta disponible en web.");
  try {
    return await import("react-native-earl-thermal-printer");
  } catch {
    throw new Error("Instala un build nativo de Yopido POS; Expo Go no incluye el controlador de impresora.");
  }
}

export async function requestBluetoothPrinterPermission() {
  if (Platform.OS !== "android") return true;
  if (Number(Platform.Version) >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  return (
    (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)) ===
    PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function listBluetoothPrinters(): Promise<PrinterCandidate[]> {
  if (!(await requestBluetoothPrinterPermission())) {
    throw new Error("Autoriza Bluetooth para buscar impresoras vinculadas.");
  }
  const { BLEPrinter } = await printerModule();
  await BLEPrinter.init();
  const devices = (await BLEPrinter.getDeviceList()) as IBLEPrinter[];
  return devices.map((device) => ({
    address: device.inner_mac_address,
    kind: "bluetooth" as const,
    name: device.device_name || device.inner_mac_address,
  }));
}

export async function discoverNetworkPrinters(): Promise<PrinterCandidate[]> {
  const { NetPrinter, NetPrinterEventEmitter, RN_THERMAL_RECEIPT_PRINTER_EVENTS } = await printerModule();
  await NetPrinter.init();
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.remove();
      reject(new Error("No se detectaron impresoras. Puedes ingresar la IP manualmente."));
    }, 15000);
    const subscription = NetPrinterEventEmitter.addListener(
      RN_THERMAL_RECEIPT_PRINTER_EVENTS.EVENT_NET_PRINTER_SCANNED_SUCCESS,
      (devices: INetPrinter[]) => {
        clearTimeout(timer);
        subscription.remove();
        resolve(
          (devices ?? []).map((device) => ({
            host: device.host,
            kind: "network" as const,
            name: device.device_name || `Impresora ${device.host}`,
            port: Number(device.port || 9100),
          })),
        );
      },
    );
    void NetPrinter.getDeviceList().catch((error) => {
      clearTimeout(timer);
      subscription.remove();
      reject(error);
    });
  });
}

export function validPrinterHost(value: string) {
  const parts = value.trim().split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function plain(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .trim();
}

function orderTypeLabel(order: Order, tableName?: string) {
  if (tableName) return tableName;
  if (order.order_type === "delivery") return "DELIVERY";
  if (order.order_type === "pickup") return "RECOJO";
  if (order.order_type === "table") return "MESA";
  return "MOSTRADOR";
}

export function buildOrderTicket(
  order: Order,
  options: {
    currency: string;
    paperWidth?: 32 | 48;
    restaurantName: string;
    tableName?: string;
  },
) {
  const totalLabel = options.currency === "BOB" ? "Bs" : options.currency;
  const separator = "-".repeat(options.paperWidth ?? 32);
  const lines = [
    `<C><BOLD>${plain(options.restaurantName).toUpperCase()}</BOLD></C>`,
    `<C>${plain(order.order_number)}</C>`,
    separator,
    `${orderTypeLabel(order, options.tableName)} | ${new Date(order.created_at).toLocaleString("es")}`,
    order.customer_name ? `Cliente: ${plain(order.customer_name)}` : "",
    order.notes ? `Nota: ${plain(order.notes)}` : "",
    separator,
    ...order.order_items.flatMap((item) => [
      `<BOLD>${item.quantity} x ${plain(item.product_name)}</BOLD>`,
      item.notes ? `  ${plain(item.notes)}` : "",
      `  ${totalLabel} ${Number(item.subtotal).toFixed(2)}`,
    ]),
    separator,
    `<R><BOLD>TOTAL ${totalLabel} ${Number(order.total).toFixed(2)}</BOLD></R>`,
    `Pago: ${order.payment_status === "paid" ? "PAGADO" : "PENDIENTE"}`,
    "",
    `<C>Yopido POS</C>`,
  ];
  return lines.filter(Boolean).join("\n");
}

async function connectedPrinter(connection: PrinterConnection) {
  const { BLEPrinter, NetPrinter } = await printerModule();
  if (connection.kind === "bluetooth") {
    if (!(await requestBluetoothPrinterPermission())) throw new Error("Bluetooth no autorizado.");
    await BLEPrinter.init();
    await BLEPrinter.connectPrinter(connection.address);
    return BLEPrinter;
  }
  await NetPrinter.init();
  await NetPrinter.connectPrinter(connection.host, connection.port);
  return NetPrinter;
}

export async function printOrderTicket(
  connection: PrinterConnection,
  order: Order,
  data: Pick<Snapshot, "restaurant" | "settings" | "tables">,
) {
  const printer = await connectedPrinter(connection);
  const tableName = data.tables.find((table) => table.id === order.table_id)?.name;
  await printer.printBill(
    buildOrderTicket(order, {
      currency: data.settings.currency,
      paperWidth: connection.paperWidth,
      restaurantName: data.restaurant.name,
      tableName,
    }),
    { beep: false, cut: true, encoding: "UTF8", tailingLine: 4 },
  );
}

export async function printTestTicket(connection: PrinterConnection, restaurantName: string) {
  const printer = await connectedPrinter(connection);
  await printer.printBill(
    `<C><BOLD>${plain(restaurantName).toUpperCase()}</BOLD></C>\n<C>Impresora conectada</C>\n<C>Papel ${connection.paperWidth === 32 ? "58" : "80"} mm</C>\n\n<C>Yopido POS</C>`,
    { beep: false, cut: true, encoding: "UTF8", tailingLine: 4 },
  );
}

export function printerErrorMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  if (/ERR_BT_DISABLED/i.test(value)) return "Activa Bluetooth e intenta nuevamente.";
  if (/ERR_BT_PERMISSION/i.test(value)) return "Autoriza Bluetooth en los ajustes del telefono.";
  if (/ERR_NOT_FOUND/i.test(value)) return "Vincula primero la impresora en los ajustes Bluetooth del telefono.";
  if (/ERR_CONNECT|timed out|failed to connect/i.test(value)) return "No se pudo conectar con la impresora. Revisa que este encendida y en la misma red.";
  return value || "No se pudo usar la impresora.";
}
