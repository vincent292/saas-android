import { useRef, useState } from "react";
import { Linking, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Camera, Search } from "lucide-react-native";
import { tableFromQr } from "@/lib/domain";
import type { Table } from "@/lib/types";
import { Button, Field, Notice, Sheet } from "./ui";
export function Scanner({
  tables,
  slug,
  onTable,
  onClose,
}: {
  tables: Table[];
  slug: string;
  onTable: (table: Table) => void;
  onClose: () => void;
}) {
  const [permission, request] = useCameraPermissions(),
    [code, setCode] = useState(""),
    [error, setError] = useState("");
  const locked = useRef(false);
  function resolve(value: string) {
    if (locked.current) return;
    locked.current = true;
    try {
      onTable(tableFromQr(value, slug, tables));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Sheet title="Escanear mesa" onClose={onClose}>
      <View
        style={{
          height: 280,
          overflow: "hidden",
          borderRadius: 8,
          backgroundColor: "#17212A",
        }}
      >
        {permission?.granted && (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => resolve(data)}
          />
        )}
      </View>
      {!permission?.granted && (
        <Button
          title={
            permission?.canAskAgain === false
              ? "Abrir permisos"
              : "Permitir camara"
          }
          icon={Camera}
          onPress={() => {
            if (permission?.canAskAgain === false) void Linking.openSettings();
            else void request();
          }}
        />
      )}
      <Notice message={error} error />
      {Boolean(error) && (
        <Button
          title="Volver a escanear"
          secondary
          onPress={() => {
            setError("");
            locked.current = false;
          }}
        />
      )}
      <Field
        label="Codigo de mesa"
        autoCapitalize="characters"
        value={code}
        onChangeText={setCode}
      />
      <Button
        title="Buscar mesa"
        icon={Search}
        onPress={() => {
          locked.current = false;
          resolve(code);
        }}
      />
    </Sheet>
  );
}
