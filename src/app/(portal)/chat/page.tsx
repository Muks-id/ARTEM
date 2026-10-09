import { createSupabaseServerClient, isAdminUser } from "@/lib/supabase";
import ChatRoom from "@/components/chat-room";
import type { ChatMessage } from "@/lib/portal-types";
import { auth } from "@clerk/nextjs/server";

export default async function ChatPage() {
  const [{ userId }, supabase] = await Promise.all([
    auth(),
    createSupabaseServerClient(),
  ]);
  if (!userId) throw new Error("Silakan masuk untuk membuka chat.");

  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at, reply_to_id, attachment_name, attachment_expires_at, attachment_downloaded_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (messageError) throw new Error(`Gagal memuat pesan: ${messageError.message}`);

  const senderIds = [
    ...new Set([
      userId,
      ...(messageRows ?? []).map((message) => message.sender_id),
    ]),
  ];
  const { data: profileRows, error: profileError } =
    senderIds.length > 0
      ? await supabase
          .from("member_directory")
          .select("id, full_name, username, avatar_url, bio")
          .in("id", senderIds)
      : { data: [], error: null };
  if (profileError) throw new Error(`Gagal memuat anggota chat: ${profileError.message}`);

  const messageIds = (messageRows ?? []).map((message) => message.id);
  const { data: reactionRows, error: reactionError } =
    messageIds.length > 0
      ? await supabase
          .from("message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", messageIds)
      : { data: [], error: null };
  if (reactionError) {
    throw new Error(`Gagal memuat reaction chat: ${reactionError.message}`);
  }

  const profilesById = new Map(
    (profileRows ?? []).map((profile) => [profile.id, profile]),
  );
  const adminUserIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const messagesById = new Map((messageRows ?? []).map((message) => [message.id, message]));
  const messages = (messageRows ?? [])
    .map((message) => ({
      ...message,
      sender: {
        ...(profilesById.get(message.sender_id) ?? {
          id: message.sender_id,
          full_name: "Anggota Artem Geng",
          username: null,
          avatar_url: null,
          bio: null,
        }),
        is_admin: isAdminUser(message.sender_id),
      },
      reply_to: message.reply_to_id
        ? (() => {
            const quoted = messagesById.get(message.reply_to_id);
            if (!quoted) return null;
            const quotedSender = profilesById.get(quoted.sender_id);
            return {
              id: quoted.id,
              content: quoted.content,
              sender: {
                id: quoted.sender_id,
                full_name: quotedSender?.full_name ?? "Anggota Artem Geng",
                username: quotedSender?.username ?? null,
                avatar_url: quotedSender?.avatar_url ?? null,
                is_admin: isAdminUser(quoted.sender_id),
              },
            };
          })()
        : null,
      reactions: (reactionRows ?? []).filter(
        (reaction) => reaction.message_id === message.id,
      ),
    }))
    .reverse() as ChatMessage[];

  const { count, error: memberCountError } = await supabase
    .from("member_directory")
    .select("id", { count: "exact", head: true });
  if (memberCountError) {
    throw new Error(`Gagal menghitung anggota komunitas: ${memberCountError.message}`);
  }

  return (
    <ChatRoom
      initialMessages={messages}
      currentUserId={userId}
      adminUserIds={adminUserIds}
      memberCount={count ?? 0}
    />
  );
}
