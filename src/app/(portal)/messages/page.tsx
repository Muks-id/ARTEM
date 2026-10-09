import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient, isAdminUser } from "@/lib/supabase";
import type {
  DirectConversationSummary,
  DirectMessage,
  MemberProfileSummary,
} from "@/lib/portal-types";
import DirectMessageInbox from "@/components/direct-message-inbox";

export default async function DirectMessagesPage() {
  const [{ userId }, supabase] = await Promise.all([
    auth(),
    createSupabaseServerClient(),
  ]);
  if (!userId) throw new Error("Silakan masuk untuk membuka chat pribadi.");

  const { data: conversations, error: conversationError } = await supabase
    .from("direct_conversations")
    .select("id, member_one_id, member_two_id, created_at")
    .or(`member_one_id.eq.${userId},member_two_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (conversationError) {
    throw new Error(`Gagal memuat chat pribadi: ${conversationError.message}`);
  }

  const memberIds = [
    ...new Set(
      (conversations ?? []).map((conversation) =>
        conversation.member_one_id === userId
          ? conversation.member_two_id
          : conversation.member_one_id,
      ),
    ),
  ];
  const { data: profiles, error: profileError } =
    memberIds.length > 0
      ? await supabase
          .from("member_directory")
          .select("id, full_name, username, avatar_url, bio")
          .in("id", memberIds)
      : { data: [], error: null };
  if (profileError) {
    throw new Error(`Gagal memuat profil percakapan: ${profileError.message}`);
  }

  const { data: allHiddenRows, error: allHiddenError } =
    await supabase
      .from("direct_message_hides")
      .select("message_id")
      .eq("user_id", userId);
  if (allHiddenError) {
    throw new Error(`Gagal membaca pesan tersembunyi: ${allHiddenError.message}`);
  }
  const hiddenIds = new Set((allHiddenRows ?? []).map((item) => item.message_id));

  const profilesById = new Map<string, MemberProfileSummary>(
    (profiles ?? []).map((profile) => [
      profile.id,
      { ...profile, is_admin: isAdminUser(profile.id) },
    ]),
  );

  const summaries = (await Promise.all(
    (conversations ?? []).map(async (conversation) => {
      const otherId =
        conversation.member_one_id === userId
          ? conversation.member_two_id
          : conversation.member_one_id;
      const hiddenMessageIds = [...hiddenIds];
      const [messageResult, unreadResult, hiddenUnreadResult] = await Promise.all([
        supabase
          .from("direct_messages")
          .select("id, conversation_id, sender_id, recipient_id, content, created_at, read_at, reply_to_id, attachment_name, attachment_expires_at, attachment_downloaded_at")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversation.id)
          .eq("recipient_id", userId)
          .is("read_at", null),
        hiddenMessageIds.length > 0
          ? supabase
              .from("direct_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", conversation.id)
              .eq("recipient_id", userId)
              .is("read_at", null)
              .in("id", hiddenMessageIds)
          : Promise.resolve({ count: 0, error: null }),
      ]);
      if (messageResult.error) {
        throw new Error(`Gagal memuat pesan inbox: ${messageResult.error.message}`);
      }
      if (unreadResult.error) {
        throw new Error(`Gagal menghitung pesan belum dilihat: ${unreadResult.error.message}`);
      }
      if (hiddenUnreadResult.error) {
        throw new Error(`Gagal menghitung pesan yang disembunyikan: ${hiddenUnreadResult.error.message}`);
      }

      const latest = (messageResult.data ?? []).find(
        (message) => !hiddenIds.has(message.id),
      ) as DirectMessage | undefined;

      if ((messageResult.data ?? []).length > 0 && !latest) return null;

      return {
        id: conversation.id,
        other_member: profilesById.get(otherId) ?? {
          id: otherId,
          full_name: "Anggota Artem Geng",
          username: null,
          avatar_url: null,
          bio: null,
          is_admin: isAdminUser(otherId),
        },
        latest_message: latest ?? null,
        unread_count: Math.max(
          0,
          (unreadResult.count ?? 0) - (hiddenUnreadResult.count ?? 0),
        ),
      } satisfies DirectConversationSummary;
    }),
  )).filter(
    (summary): summary is DirectConversationSummary => summary !== null,
  );

  return <DirectMessageInbox initialConversations={summaries} currentUserId={userId} />;
}
