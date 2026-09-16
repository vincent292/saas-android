export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
export const isConfigured = Boolean(
  config.apiUrl && config.supabaseUrl && config.supabaseKey,
);
