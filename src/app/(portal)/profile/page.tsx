import { auth } from "@clerk/nextjs/server";
import ProfileEditor from "@/components/profile-editor";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Profile, ProfileFile, TaskStatus } from "@/lib/portal-types";

export default async function ProfilePage() {
  const [{ userId }, supabase] = await Promise.all([
    auth(),
    createSupabaseServerClient(),
  ]);
  if (!userId) throw new Error("Silakan masuk untuk membuka profil.");

  const [
    { data: profile, error: profileError },
    { data: tasks, error: taskError },
    { data: personalFiles, error: filesError },
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, avatar_path, email, bio, updated_at")
        .eq("id", userId)
        .single(),
      supabase.from("tasks").select("status").eq("user_id", userId),
      supabase
        .from("profile_files")
        .select("id, owner_id, file_name, content_type, size_bytes, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
    ]);
  if (profileError) throw new Error(`Gagal memuat profil: ${profileError.message}`);
  if (taskError) throw new Error(`Gagal memuat statistik task: ${taskError.message}`);
  if (filesError) throw new Error(`Gagal memuat file pribadi: ${filesError.message}`);

  const counts: Record<TaskStatus, number> = {
    belum_dikerjakan: 0,
    dikerjakan: 0,
    selesai: 0,
  };
  for (const task of tasks ?? []) {
    if (task.status in counts) counts[task.status as TaskStatus] += 1;
  }

  return (
    <ProfileEditor
      profile={profile as Profile}
      counts={counts}
      initialPersonalFiles={(personalFiles ?? []) as ProfileFile[]}
    />
  );
}
