import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AdminProfileFiles from "@/components/admin-profile-files";
import AdminTaskManager from "@/components/admin-task-manager";
import type { AdminProfileFile, Task } from "@/lib/portal-types";
import {
  createSupabaseAdminClient,
  isAdminUser,
} from "@/lib/supabase";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");
  if (!isAdminUser(userId)) redirect("/tasks");

  const supabase = createSupabaseAdminClient();
  const [
    { data: taskData, error: taskError },
    { data: profileData, error: profileError },
    { data: fileData, error: fileError },
  ] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, user_id, project_name, title, description, status, completed_at, revision_notes, revision_date, is_new, needs_revision, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, username, avatar_url, bio, email"),
      supabase
        .from("profile_files")
        .select("id, owner_id, file_name, content_type, size_bytes, created_at")
        .order("created_at", { ascending: false }),
    ]);

  if (taskError) throw new Error(`Gagal memuat task admin: ${taskError.message}`);
  if (profileError) throw new Error(`Gagal memuat anggota: ${profileError.message}`);
  if (fileError) throw new Error(`Gagal memuat file pribadi anggota: ${fileError.message}`);

  const profiles = new Map(
    (profileData ?? []).map((profile) => [profile.id, profile]),
  );
  const tasks = ((taskData ?? []) as Task[]).map((task) => {
    const owner = profiles.get(task.user_id);
    return {
      ...task,
      ownerName: owner?.full_name ?? task.user_id,
      ownerEmail: owner?.email ?? "",
      ownerProfile: {
        id: task.user_id,
        full_name: owner?.full_name ?? task.user_id,
        username: owner?.username ?? null,
        avatar_url: owner?.avatar_url ?? null,
        bio: owner?.bio ?? null,
        is_admin: isAdminUser(task.user_id),
      },
    };
  });
  const files: AdminProfileFile[] = (fileData ?? []).map((file) => {
    const owner = profiles.get(file.owner_id);
    return {
      ...file,
      owner_name: owner?.full_name ?? file.owner_id,
    };
  });

  return (
    <div className="space-y-10">
      <AdminTaskManager initialTasks={tasks} currentUserId={userId} />
      <AdminProfileFiles files={files} />
    </div>
  );
}