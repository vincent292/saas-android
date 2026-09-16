import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, LogIn, LogOut, RefreshCw, Store } from "lucide-react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { api, errorMessage } from "@/lib/api";
import type { Profile, Restaurant } from "@/lib/types";
import { Button, c, Empty, Field, Label, Notice, Title } from "./ui";

WebBrowser.maybeCompleteAuthSession();

export function Brand() {
  return (
    <Image
      source={require("../../../assets/images/yopido-logo.png")}
      resizeMode="contain"
      style={{ width: 162, height: 62 }}
    />
  );
}
export function Login({
  passwordChange = false,
}: {
  passwordChange?: boolean;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    if (!supabase || busy) return;
    setError("");
    if (!password || (!passwordChange && !email.trim())) {
      setError("Completa los datos de acceso.");
      return;
    }
    if (
      passwordChange &&
      (password.length < 12 ||
        !/[a-z]/.test(password) ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password) ||
        password !== confirm)
    ) {
      setError("Usa 12 caracteres con mayuscula, minuscula y numero, y confirma la misma contrasena.");
      return;
    }
    setBusy(true);
    try {
      const result = passwordChange
        ? await supabase.auth.updateUser({
            password,
            data: { must_change_password: false },
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (result.error) throw new Error(result.error.message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    if (!supabase || busy || passwordChange) return;
    setBusy(true);
    setError("");
    try {
      const redirectTo = Platform.OS === "web"
        ? window.location.origin
        : Linking.createURL("auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== "web",
        },
      });
      if (error) throw error;
      if (Platform.OS === "web") return;
      if (!data.url) throw new Error("No se pudo abrir Google.");
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return;
      const callback = new URL(result.url.replace("#", "?"));
      const code = callback.searchParams.get("code");
      if (code) {
        const exchange = await supabase.auth.exchangeCodeForSession(code);
        if (exchange.error) throw exchange.error;
        return;
      }
      const accessToken = callback.searchParams.get("access_token");
      const refreshToken = callback.searchParams.get("refresh_token");
      if (!accessToken || !refreshToken) throw new Error(callback.searchParams.get("error_description") || "Google no devolvio una sesion valida.");
      const sessionResult = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionResult.error) throw sessionResult.error;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.white }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 28,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 410,
              alignSelf: "center",
              gap: 24,
            }}
          >
            <Brand />
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 30, fontWeight: "700", color: c.ink }}>
                {passwordChange ? "Nueva contrasena" : "Tu turno empieza aqui"}
              </Text>
              <Label muted>
                {passwordChange ? "Actualiza tu acceso" : "POS Yopido"}
              </Label>
            </View>
            {!passwordChange && (
              <Field
                label="Correo electronico"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            )}
            <Field
              label={passwordChange ? "Nueva contrasena" : "Contrasena"}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={
                passwordChange ? "new-password" : "current-password"
              }
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
            />
            {passwordChange && (
              <Field
                label="Confirmar contrasena"
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
              />
            )}
            <Notice message={error} error />
            {!supabase && (
              <Notice error message="Falta configurar la conexion del POS." />
            )}
            <Button
              title={passwordChange ? "Guardar contrasena" : "Iniciar sesion"}
              icon={ArrowRight}
              onPress={() => void submit()}
              busy={busy}
              disabled={!supabase}
            />
            {!passwordChange && (
              <Button
                title="Continuar con Google"
                icon={LogIn}
                secondary
                onPress={() => void google()}
                busy={busy}
                disabled={!supabase}
              />
            )}
            <Text
              style={{
                color: c.muted,
                fontSize: 12,
                textAlign: "center",
                marginTop: 24,
              }}
            >
              Yopido · Punto de venta
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Access({
  render,
}: {
  render: (
    restaurant: Restaurant,
    profile: Profile,
    change: () => void,
  ) => ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null),
    [restaurants, setRestaurants] = useState<Restaurant[]>([]),
    [selected, setSelected] = useState<Restaurant | null>(null);
  const [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => {
      data.subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  const userId = session?.user.id;
  const passwordChange =
    session?.user.user_metadata.must_change_password === true;
  useEffect(() => {
    let active = true;
    setProfile(null);
    setRestaurants([]);
    setSelected(null);
    setError("");
    if (!userId || passwordChange) return;
    api<{ profile: Profile; restaurants: Restaurant[] }>()
      .then((data) => {
        if (!active) return;
        setProfile(data.profile);
        setRestaurants(data.restaurants);
        if (data.restaurants.length === 1) setSelected(data.restaurants[0]);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [userId, passwordChange, attempt]);
  if (loading) return <Loading />;
  if (!session) return <Login />;
  if (passwordChange) return <Login passwordChange />;
  if (selected && profile)
    return (
      <View style={{ flex: 1 }} key={selected.id}>
        {render(selected, profile, () => setSelected(null))}
      </View>
    );
  if (!profile && !error) return <Loading />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.white }}>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          gap: 22,
          width: "100%",
          maxWidth: 650,
          alignSelf: "center",
        }}
      >
        <Brand />
        <Title>Selecciona tu restaurante</Title>
        <Notice error message={error} />
        {restaurants.map((r) => (
          <Button
            key={r.id}
            title={r.name + " · " + (r.canManage ? "Caja / POS" : "Mesero")}
            icon={Store}
            secondary
            onPress={() => setSelected(r)}
          />
        ))}
        {profile && !restaurants.length && (
          <Empty
            title="Sin restaurantes asignados"
            detail="Tu cuenta necesita un rol de administrador, cajero o mesero activo."
          />
        )}
        <Button
          title="Actualizar acceso"
          icon={RefreshCw}
          secondary
          onPress={() => setAttempt((v) => v + 1)}
        />
        <Button
          title="Cerrar sesion"
          icon={LogOut}
          secondary
          onPress={() => {
            void supabase?.auth.signOut({ scope: "local" });
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
function Loading() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.white,
        gap: 20,
      }}
    >
      <Brand />
      <ActivityIndicator color={c.ink} />
    </View>
  );
}
