import { useState } from "react";
import { Image, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, Trash2 } from "lucide-react-native";
import type { Receipt } from "@/lib/types";
import { Button, IconButton, Notice, s } from "./ui";
export function ReceiptPicker({
  value,
  onChange,
  disabled,
}: {
  value: Receipt | null;
  onChange: (value: Receipt | null) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  async function pick(camera: boolean) {
    setError("");
    try {
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      )
        throw new Error("Permite el acceso a la camara para tomar la foto.");
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.7,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024)
        throw new Error("La imagen supera los 5 MB.");
      onChange(asset);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      {value && (
        <View style={s.between}>
          <Image
            source={{ uri: value.uri }}
            style={{ width: 100, height: 120 }}
            resizeMode="contain"
          />
          <IconButton
            icon={Trash2}
            label="Quitar comprobante"
            onPress={() => onChange(null)}
            disabled={disabled}
          />
        </View>
      )}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button
            title="Foto"
            icon={Camera}
            secondary
            disabled={disabled}
            onPress={() => void pick(true)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Galeria"
            icon={ImagePlus}
            secondary
            disabled={disabled}
            onPress={() => void pick(false)}
          />
        </View>
      </View>
      <Notice message={error} error />
    </View>
  );
}
