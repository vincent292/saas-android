import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import { config } from "./config";
import { supabase } from "./supabase";
import type { Receipt } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const messages: Record<string, string> = {
  "no-open-cash": "La caja esta cerrada.",
  "no-open-session": "La caja esta cerrada.",
  "session-open": "Ya hay una caja abierta.",
  "receipt-required": "Adjunta el comprobante o ingresa la referencia.",
  "cash access denied": "Tu cuenta no tiene permiso para operar caja.",
  "Invalid login credentials": "Correo o contrasena incorrectos.",
};
export function errorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo completar la operacion.";
  return messages[message] ?? message;
}
export async function api<T>(
  query = "",
  payload?: unknown,
  receipt?: Receipt | null,
): Promise<T> {
  if (!supabase) throw new Error("Falta configurar la conexion.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session)
    throw new ApiError("Inicia sesion para continuar.", 401);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${data.session.access_token}`,
  };
  let body: string | FormData | undefined;
  if (payload && receipt) {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    if (Platform.OS === "web") {
      form.append(
        "receipt",
        await (await fetch(receipt.uri)).blob(),
        receipt.fileName || "comprobante.jpg",
      );
    } else {
      form.append(
        "receipt",
        new File(receipt.uri) as unknown as Blob,
        receipt.fileName || "comprobante.jpg",
      );
    }
    body = form;
  } else if (payload) {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await expoFetch(`${config.apiUrl}/api/mobile/pos${query}`, {
      method: payload ? "POST" : "GET",
      headers,
      body,
      signal: controller.signal,
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new ApiError(
        "La API del POS aun no esta disponible en este servidor.",
        response.status,
      );
    const result = await response.json();
    if (!response.ok)
      throw new ApiError(result.error || "Error de conexion.", response.status);
    return result as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        payload
          ? "La respuesta tardo demasiado. Actualiza los pedidos antes de reintentar."
          : "La sincronizacion tardo demasiado. Conservamos los datos anteriores; intenta actualizar otra vez.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
