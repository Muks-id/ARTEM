import { createClient } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

let browserClient: ReturnType<typeof createClient> | undefined;
let getClerkAccessToken: (() => Promise<string | null>) | undefined;

export function setSupabaseBrowserAccessTokenProvider(
  provider: () => Promise<string | null>,
) {
  getClerkAccessToken = provider;
}

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => {
        const token = await getClerkAccessToken?.();
        if (!token) throw new Error("Sesi Clerk tidak tersedia untuk Supabase.");
        return token;
      },
    });
  }

  return browserClient;
}
