import { useCallback, useEffect, useRef, useState } from "react";
import type { Order, Snapshot } from "@/lib/types";
import {
  printOrderTicket,
  printTestTicket,
  printerErrorMessage,
  readPrinterConnection,
  savePrinterConnection,
  type PrinterConnection,
} from "@/lib/pos-printer";

export function usePosPrinter(restaurantId: string) {
  const [connection, setConnectionState] = useState<PrinterConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void readPrinterConnection(restaurantId).then((saved) => {
      if (active) {
        setConnectionState(saved);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const setConnection = useCallback(
    async (next: PrinterConnection | null) => {
      await savePrinterConnection(restaurantId, next);
      setConnectionState(next);
      setError("");
      setMessage(next ? `Impresora ${next.name} guardada.` : "Impresora desconectada del POS.");
    },
    [restaurantId],
  );

  const run = useCallback(async (work: () => Promise<void>, success: string) => {
    setPrinting(true);
    setError("");
    setMessage("");
    const operation = queue.current.then(work, work);
    queue.current = operation.catch(() => undefined);
    try {
      await operation;
      setMessage(success);
      return true;
    } catch (cause) {
      setError(printerErrorMessage(cause));
      return false;
    } finally {
      setPrinting(false);
    }
  }, []);

  const print = useCallback(
    async (order: Order, data: Pick<Snapshot, "restaurant" | "settings" | "tables">, automatic = false) => {
      if (!connection) {
        if (!automatic) setError("Configura una impresora Bluetooth o Wi-Fi.");
        return false;
      }
      if (automatic && !connection.autoPrint) return false;
      return run(() => printOrderTicket(connection, order, data), automatic ? "Venta impresa automaticamente." : "Ticket impreso.");
    },
    [connection, run],
  );

  const test = useCallback(
    async (restaurantName: string) => {
      if (!connection) {
        setError("Selecciona una impresora primero.");
        return false;
      }
      return run(() => printTestTicket(connection, restaurantName), "Prueba impresa correctamente.");
    },
    [connection, run],
  );

  return {
    connection,
    error,
    loading,
    message,
    print,
    printing,
    setConnection,
    setError,
    setMessage,
    test,
  };
}
