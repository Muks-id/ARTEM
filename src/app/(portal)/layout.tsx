import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import { createSupabaseServerClient, isAdminUser } from "@/lib/supabase";
import type { Profile } from "@/lib/portal-types";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  if (!user) redirect("/");

  const email =
    user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("Akun Clerk ini belum memiliki alamat email.");

  const supabase = await createSupabaseServerClient();
  const { data: existingProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileReadError) {
    if (profileReadError.message.includes("No suitable key or wrong key type")) {
      throw new Error(
        "Supabase menolak token Clerk. Aktifkan integrasi Supabase pada Clerk, lalu tambahkan provider Clerk di Supabase > Authentication > Sign In / Providers > Third-party menggunakan Clerk domain yang sama. Pastikan konfigurasi token Clerk menyertakan role=authenticated. Setelah konfigurasi disimpan, coba login ulang.",
      );
    }
    throw new Error(`Gagal memeriksa profil Supabase: ${profileReadError.message}`);
  }

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    email.split("@")[0];

  if (existingProfile) {
    const { error } = await supabase
      .from("profiles")
      .update({
        email,
      })
      .eq("id", user.id);
    if (error) throw new Error(`Gagal menyinkronkan profil: ${error.message}`);
  } else {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      username: user.username,
      avatar_url: user.imageUrl,
      avatar_path: null,
      email,
    });
    if (error) throw new Error(`Gagal membuat profil: ${error.message}`);
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, avatar_path, email, bio, updated_at")
    .eq("id", user.id)
    .single();

  if (profileError) throw new Error(`Gagal memuat profil: ${profileError.message}`);

  const { data: readState, error: readStateError } = await supabase
    .from("community_chat_reads")
    .select("last_read_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readStateError) {
    throw new Error(`Gagal memuat status baca chat room: ${readStateError.message}`);
  }
  const lastReadAt = readState?.last_read_at ?? "1970-01-01T00:00:00.000Z";
  const [
    { count: unreadCommunityCount, error: communityCountError },
    { count: unreadDirectCount, error: directCountError },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .neq("sender_id", user.id)
      .gt("created_at", lastReadAt),
    supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);
  if (communityCountError) {
    throw new Error(`Gagal menghitung pesan chat room yang belum dibuka: ${communityCountError.message}`);
  }
  if (directCountError) {
    throw new Error(`Gagal menghitung pesan pribadi yang belum dibuka: ${directCountError.message}`);
  }

  return (
    <PortalShell
      profile={profileData as Profile}
      isAdmin={isAdminUser(user.id)}
      currentUserId={user.id}
      initialUnreadCommunityCount={unreadCommunityCount ?? 0}
      initialUnreadDirectCount={unreadDirectCount ?? 0}
    >
      {children}
    </PortalShell>
  );
}
