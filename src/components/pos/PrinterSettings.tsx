import { useState } from "react";
import { Platform, Pressable, Switch, Text, View } from "react-native";
import { Bluetooth, Network, Printer, Search } from "lucide-react-native";
import type { usePosPrinter } from "@/hooks/use-pos-printer";
import {
  discoverNetworkPrinters,
  listBluetoothPrinters,
  printerErrorMessage,
  validPrinterHost,
  type PrinterCandidate,
  type PrinterConnection,
} from "@/lib/pos-printer";
import { Button, c, Field, Label, Notice, s, Sheet } from "./ui";

type PrinterManager = ReturnType<typeof usePosPrinter>;

export function PrinterSettings({
  manager,
  onClose,
  restaurantName,
}: {
  manager: PrinterManager;
  onClose: () => void;
  restaurantName: string;
}) {
  const [bluetooth, setBluetooth] = useState<PrinterCandidate[]>([]);
  const [network, setNetwork] = useState<PrinterCandidate[]>([]);
  const [host, setHost] = useState(
    manager.connection?.kind === "network" ? manager.connection.host : "",
  );
  const [port, setPort] = useState(
    manager.connection?.kind === "network" ? String(manager.connection.port) : "9100",
  );
  const [searching, setSearching] = useState<"bluetooth" | "network" | null>(null);
  const [localError, setLocalError] = useState("");
  const paperWidth = manager.connection?.paperWidth ?? 48;
  const autoPrint = manager.connection?.autoPrint ?? true;

  async function searchBluetooth() {
    setSearching("bluetooth");
    setLocalError("");
    try {
      setBluetooth(await listBluetoothPrinters());
    } catch (error) {
      setLocalError(printerErrorMessage(error));
    } finally {
      setSearching(null);
    }
  }

  async function searchNetwork() {
    setSearching("network");
    setLocalError("");
    try {
      setNetwork(await discoverNetworkPrinters());
    } catch (error) {
      setLocalError(printerErrorMessage(error));
    } finally {
      setSearching(null);
    }
  }

  async function select(candidate: PrinterCandidate) {
    const connection: PrinterConnection =
      candidate.kind === "bluetooth"
        ? {
            address: candidate.address,
            autoPrint,
            kind: "bluetooth",
            name: candidate.name,
            paperWidth,
          }
        : {
            autoPrint,
            host: candidate.host,
            kind: "network",
            name: candidate.name,
            paperWidth,
            port: candidate.port,
          };
    await manager.setConnection(connection);
  }

  async function saveNetwork() {
    const cleanHost = host.trim();
    const cleanPort = Number(port);
    if (!validPrinterHost(cleanHost) || !Number.isInteger(cleanPort) || cleanPort < 1 || cleanPort > 65535) {
      setLocalError("Ingresa una IP valida y un puerto entre 1 y 65535.");
      return;
    }
    setLocalError("");
    await select({ host: cleanHost, kind: "network", name: `Impresora ${cleanHost}`, port: cleanPort });
  }

  async function updateCurrent(changes: Partial<Pick<PrinterConnection, "autoPrint" | "paperWidth">>) {
    if (!manager.connection) return;
    await manager.setConnection({ ...manager.connection, ...changes } as PrinterConnection);
  }

  return (
    <Sheet title="Impresora" onClose={onClose}>
      {Platform.OS === "web" ? (
        <Notice error message="La impresion Bluetooth/Wi-Fi se configura desde la app Android instalada." />
      ) : null}
      {manager.connection ? (
        <View style={{ backgroundColor: "#EDF7F1", borderRadius: 8, gap: 8, padding: 14 }}>
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Label>Seleccionada: {manager.connection.name}</Label>
              <Label muted>
                {manager.connection.kind === "bluetooth"
                  ? `Bluetooth · ${manager.connection.address}`
                  : `Wi-Fi · ${manager.connection.host}:${manager.connection.port}`}
              </Label>
            </View>
            <Printer color={c.green} size={24} />
          </View>
          <View style={s.between}>
            <Label>Imprimir ventas automaticamente</Label>
            <Switch
              accessibilityLabel="Impresion automatica"
              onValueChange={(value) => void updateCurrent({ autoPrint: value })}
              trackColor={{ false: c.line, true: c.lime }}
              thumbColor={c.white}
              value={manager.connection.autoPrint}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Papel 58 mm"
                secondary={manager.connection.paperWidth !== 32}
                onPress={() => void updateCurrent({ paperWidth: 32 })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Papel 80 mm"
                secondary={manager.connection.paperWidth !== 48}
                onPress={() => void updateCurrent({ paperWidth: 48 })}
              />
            </View>
          </View>
          <Button
            title="Imprimir prueba"
            icon={Printer}
            busy={manager.printing}
            onPress={() => void manager.test(restaurantName)}
          />
          <Button title="Quitar impresora" secondary onPress={() => void manager.setConnection(null)} />
        </View>
      ) : (
        <Notice message="Selecciona una impresora. Las Bluetooth deben estar vinculadas previamente en Android." />
      )}

      <View style={{ gap: 10 }}>
        <Label>Bluetooth</Label>
        <Button
          title="Buscar vinculadas"
          icon={Bluetooth}
          secondary
          busy={searching === "bluetooth"}
          onPress={() => void searchBluetooth()}
        />
        {bluetooth.map((candidate) =>
          candidate.kind === "bluetooth" ? (
            <DeviceButton
              key={candidate.address}
              label={candidate.name}
              detail={candidate.address}
              onPress={() => void select(candidate)}
            />
          ) : null,
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Label>Wi-Fi / red local</Label>
        <Button
          title="Buscar en la red"
          icon={Search}
          secondary
          busy={searching === "network"}
          onPress={() => void searchNetwork()}
        />
        {network.map((candidate) =>
          candidate.kind === "network" ? (
            <DeviceButton
              key={`${candidate.host}:${candidate.port}`}
              label={candidate.name}
              detail={`${candidate.host}:${candidate.port}`}
              onPress={() => void select(candidate)}
            />
          ) : null,
        )}
        <Field label="IP de la impresora" keyboardType="numbers-and-punctuation" value={host} onChangeText={setHost} />
        <Field label="Puerto" keyboardType="number-pad" value={port} onChangeText={setPort} />
        <Button title="Guardar impresora de red" icon={Network} onPress={() => void saveNetwork()} />
      </View>

      <Notice error message={localError || manager.error} />
      <Notice message={manager.message} />
    </Sheet>
  );
}

function DeviceButton({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        borderColor: c.line,
        borderRadius: 8,
        borderWidth: 1,
        gap: 3,
        opacity: pressed ? 0.7 : 1,
        padding: 13,
      })}
    >
      <Text style={{ color: c.ink, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{detail}</Text>
    </Pressable>
  );
}
