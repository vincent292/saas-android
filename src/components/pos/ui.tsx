import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { X, type LucideIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export const c = {
  ink: "#12355B",
  lime: "#C7F000",
  white: "#FFFFFF",
  page: "#F4F6F8",
  line: "#DCE2E8",
  muted: "#647182",
  green: "#18704D",
  red: "#B33040",
  amber: "#926500",
};
export function Label({
  children,
  muted = false,
}: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[s.text, muted && { color: c.muted }]}>{children}</Text>;
}
export function Title({ children }: PropsWithChildren) {
  return <Text style={s.title}>{children}</Text>;
}
export function Button({
  title,
  icon: Icon,
  onPress,
  busy,
  disabled,
  secondary = false,
}: {
  title: string;
  icon?: LucideIcon;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={c.ink} />
      ) : Icon ? (
        <Icon size={19} color={c.ink} />
      ) : null}
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[s.iconButton, disabled && { opacity: 0.3 }]}
    >
      <Icon size={21} color={c.ink} />
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 80, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Notice({
  message,
  error = false,
}: {
  message?: string;
  error?: boolean;
}) {
  return message ? (
    <View
      accessibilityRole="alert"
      style={[s.notice, error && { backgroundColor: "#FCEEF0" }]}
    >
      <Text
        style={{ color: error ? c.red : c.green, fontSize: 14, lineHeight: 21 }}
      >
        {message}
      </Text>
    </View>
  ) : null;
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <View style={s.empty}>
      <Title>{title}</Title>
      {detail && <Label muted>{detail}</Label>}
      {action}
    </View>
  );
}
export function Sheet({
  title,
  onClose,
  children,
  footer,
  visible = true,
}: PropsWithChildren<{
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  visible?: boolean;
}>) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.sheet}>
        <View style={s.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Title>{title}</Title>
          </View>
          <IconButton icon={X} label="Cerrar" onPress={onClose} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.sheetBody}
        >
          {children}
        </ScrollView>
        {footer && <View style={s.footer}>{footer}</View>}
      </SafeAreaView>
    </Modal>
  );
}
export function Money({
  value,
  currency = "BOB",
  large = false,
}: {
  value: number;
  currency?: string;
  large?: boolean;
}) {
  return (
    <Text style={[s.money, large && { fontSize: 28 }]}>
      {currency === "BOB" ? "Bs" : currency} {Number(value).toFixed(2)}
    </Text>
  );
}
export const s = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 21, color: c.ink, letterSpacing: 0 },
  title: { fontSize: 21, fontWeight: "700", color: c.ink, letterSpacing: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    backgroundColor: c.lime,
    minHeight: 48,
    borderRadius: 7,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  buttonText: {
    color: c.ink,
    fontWeight: "700",
    fontSize: 14,
    flexShrink: 1,
    textAlign: "center",
  },
  secondary: { backgroundColor: c.white, borderWidth: 1, borderColor: c.line },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: c.page,
  },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: c.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 7,
    backgroundColor: c.white,
    color: c.ink,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
  },
  notice: { padding: 12, borderRadius: 6, backgroundColor: "#EDF7F1" },
  empty: {
    paddingVertical: 45,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 14,
  },
  sheet: { flex: 1, backgroundColor: c.white },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  sheetBody: {
    padding: 20,
    gap: 20,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  footer: { padding: 16, borderTopWidth: 1, borderColor: c.line, gap: 8 },
  money: {
    fontSize: 17,
    fontWeight: "700",
    color: c.ink,
    fontVariant: ["tabular-nums"],
  },
  section: { padding: 18, gap: 16 },
  divider: { height: 1, backgroundColor: c.line },
  badge: {
    color: c.green,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "#EAF5EE",
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: "flex-start",
    borderRadius: 4,
  },
});
