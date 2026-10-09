import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import DirectChatRoom from "@/components/direct-chat-room";
import {
  createSupabaseServerClient,
  isAdminUser,
} from "@/lib/supabase";
import type { DirectMessageWithSender, MemberProfileSummary } from "@/lib/portal-types";

export default async function DirectConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const [{ userId }, { conversationId }, supabase] = await Promise.all([
    auth(),
    params,
    createSupabaseServerClient(),
  ]);
  if (!userId) throw new Error("Silakan masuk untuk membuka chat pribadi.");

  const { data: conversation, error: conversationError } = await supabase
    .from("direct_conversations")
    .select("id, member_one_id, member_two_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) {
    throw new Error(`Gagal membuka percakapan: ${conversationError.message}`);
  }
  if (!conversation) notFound();

  const otherMemberId =
    conversation.member_one_id === userId
      ? conversation.member_two_id
      : conversation.member_one_id;
  if (
    conversation.member_one_id !== userId &&
    conversation.member_two_id !== userId
  ) {
    notFound();
  }

  const memberIds = [userId, otherMemberId];
  const { data: profileRows, error: profileError } = await supabase
    .from("member_directory")
    .select("id, full_name, username, avatar_url, bio")
    .in("id", memberIds);
  if (profileError) {
    throw new Error(`Gagal memuat profil chat: ${profileError.message}`);
  }
  const profiles = new Map<string, MemberProfileSummary>(
    (profileRows ?? []).map((profile) => [
      profile.id,
      { ...profile, is_admin: isAdminUser(profile.id) },
    ]),
  );
  const currentMember = profiles.get(userId);
  const otherMember = profiles.get(otherMemberId);
  if (!currentMember || !otherMember) {
    throw new Error("Profil anggota chat tidak ditemukan.");
  }

  const { error: readError } = await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (readError) {
    throw new Error(`Gagal menandai pesan telah dilihat: ${readError.message}`);
  }

  const { data: messageRows, error: messageError } = await supabase
    .from("direct_messages")
    .select("id, conversation_id, sender_id, recipient_id, content, created_at, read_at, reply_to_id, attachment_name, attachment_expires_at, attachment_downloaded_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (messageError) {
    throw new Error(`Gagal memuat pesan pribadi: ${messageError.message}`);
  }

  const messageIds = (messageRows ?? []).map((message) => message.id);
  const { data: hiddenRows, error: hiddenError } =
    messageIds.length > 0
      ? await supabase
          .from("direct_message_hides")
          .select("message_id")
          .eq("user_id", userId)
          .in("message_id", messageIds)
      : { data: [], error: null };
  if (hiddenError) {
    throw new Error(`Gagal memuat pesan tersembunyi: ${hiddenError.message}`);
  }
  const hiddenIds = new Set((hiddenRows ?? []).map((row) => row.message_id));
  const { data: reactionRows, error: reactionError } =
    messageIds.length > 0
      ? await supabase
          .from("direct_message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", messageIds)
      : { data: [], error: null };
  if (reactionError) {
    throw new Error(`Gagal memuat reaction pesan: ${reactionError.message}`);
  }
  const messagesById = new Map((messageRows ?? []).map((message) => [message.id, message]));
  const messages = (messageRows ?? [])
    .filter((message) => !hiddenIds.has(message.id))
    .map((message) => ({
      ...message,
      sender: profiles.get(message.sender_id) ?? otherMember,
      reply_to: message.reply_to_id
        ? (() => {
            const quoted = messagesById.get(message.reply_to_id);
            if (!quoted) return null;
            const hiddenQuote = hiddenIds.has(quoted.id);
            return hiddenQuote
              ? null
              : {
                  id: quoted.id,
                  content: quoted.content,
                  sender: profiles.get(quoted.sender_id) ?? otherMember,
                };
          })()
        : null,
      reactions: (reactionRows ?? []).filter(
        (reaction) => reaction.message_id === message.id,
      ),
    })) as DirectMessageWithSender[];

  return (
    <DirectChatRoom
      conversationId={conversationId}
      currentUserId={userId}
      currentMember={currentMember}
      otherMember={otherMember}
      initialMessages={messages}
    />
  );
}
