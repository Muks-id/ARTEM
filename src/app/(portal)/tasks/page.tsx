import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient, isAdminUser } from "@/lib/supabase";
import TaskManager from "@/components/task-manager";
import type { Task } from "@/lib/portal-types";

export default async function TasksPage() {
  const [{ userId }, supabase] = await Promise.all([
    auth(),
    createSupabaseServerClient(),
  ]);
  if (!userId) throw new Error("Silakan masuk untuk melihat task.");

  const { data, error } = await supabase
    .from("tasks")
    .select("id, user_id, project_name, title, position, description, status, completed_at, revision_notes, revision_date, is_new, needs_revision, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat task: ${error.message}`);

  const userIds = [...new Set((data ?? []).map((task) => task.user_id))];
  const { data: creators, error: creatorError } =
    userIds.length > 0
      ? await supabase
          .from("member_directory")
          .select("id, full_name, username, avatar_url, bio")
          .in("id", userIds)
      : { data: [], error: null };

  if (creatorError) {
    throw new Error(`Gagal memuat nama pembuat task: ${creatorError.message}`);
  }

  const creatorProfiles = new Map(
    (creators ?? []).map((creator) => [
      creator.id,
      {
        id: creator.id,
        full_name: creator.full_name,
        username: creator.username,
        avatar_url: creator.avatar_url,
        bio: creator.bio,
        is_admin: isAdminUser(creator.id),
      },
    ]),
  );
  const tasks = (data ?? []).map((task) => ({
    ...task,
    creator_name:
      creatorProfiles.get(task.user_id)?.full_name ?? "Anggota Artem Geng",
    creator_profile: creatorProfiles.get(task.user_id) ?? {
      id: task.user_id,
      full_name: "Anggota Artem Geng",
      username: null,
      avatar_url: null,
      bio: null,
      is_admin: isAdminUser(task.user_id),
    },
  })) as Task[];

  return (
    <TaskManager
      initialTasks={tasks}
      currentUserId={userId}
      canDelete={isAdminUser(userId)}
    />
  );
}
