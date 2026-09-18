import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Minus, Plus, RotateCcw, X } from "lucide-react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const AnimatedImage = Animated.createAnimatedComponent(Image);

export function ReceiptViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  useEffect(() => {
    reset();
    setLoading(true);
    setLoadError(false);
  }, [uri]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  function zoom(delta: number) {
    const next = Math.max(1, Math.min(5, scale.value + delta));
    scale.value = withTiming(next);
    savedScale.value = next;
    if (next === 1) reset();
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#07111D" }}>
        <View style={{ minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>Comprobante</Text>
          <ViewerButton label="Cerrar" onPress={onClose}><X color="white" size={24} /></ViewerButton>
        </View>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
          <View style={{ flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            <AnimatedImage
              accessibilityLabel="Imagen del comprobante"
              cachePolicy="none"
              contentFit="contain"
              onDisplay={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setLoadError(true);
              }}
              recyclingKey={uri}
              source={uri}
              style={[{ width, height: height - 150 }, animatedStyle]}
            />
            {loading ? (
              <View style={{ position: "absolute", alignItems: "center", gap: 12 }}>
                <ActivityIndicator color="white" size="large" />
                <Text style={{ color: "white", fontWeight: "600" }}>Cargando comprobante…</Text>
              </View>
            ) : null}
            {loadError ? (
              <View style={{ position: "absolute", maxWidth: 300, alignItems: "center", gap: 8, padding: 20 }}>
                <Text style={{ color: "white", textAlign: "center", fontSize: 16, fontWeight: "700" }}>
                  No se pudo mostrar el comprobante.
                </Text>
                <Text style={{ color: "#B9C4D0", textAlign: "center" }}>
                  Cierra esta vista y vuelve a intentarlo para generar un enlace nuevo.
                </Text>
              </View>
            ) : null}
          </View>
        </GestureDetector>
        <View style={{ minHeight: 72, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14 }}>
          <ViewerButton label="Alejar" onPress={() => zoom(-0.5)}><Minus color="white" size={23} /></ViewerButton>
          <ViewerButton label="Restablecer zoom" onPress={reset}><RotateCcw color="white" size={21} /></ViewerButton>
          <ViewerButton label="Acercar" onPress={() => zoom(0.5)}><Plus color="white" size={23} /></ViewerButton>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ViewerButton({ children, label, onPress }: { children: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={{ width: 46, height: 46, borderRadius: 6, backgroundColor: "#172536", alignItems: "center", justifyContent: "center" }}>
      {children}
    </Pressable>
  );
}
