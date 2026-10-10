"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  EllipsisVertical,
  LoaderCircle,
  Mail,
  MessageCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hideAllDirectMessages } from "@/app/actions";
import {
  createSupabaseBrowserClient,
  setSupabaseBrowserAccessTokenProvider,
} from "@/lib/supabase-browser";
import type { DirectConversationSummary } from "@/lib/portal-types";

export default function DirectMessageInbox({
  initialConversations,
  currentUserId,
}: {
  initialConversations: DirectConversationSummary[];
  currentUserId: string;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [error, setError] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);
  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unread_count,
    0,
  );

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  async function handleHideConversation(conversationId: string) {
    const target = conversations.find((item) => item.id === conversationId);
    const memberName = target?.other_member.full_name ?? "anggota ini";
    if (
      !window.confirm(
        `Sembunyikan semua chat dengan ${memberName} dari inbox Anda? Chat tidak akan dihapus dari inbox mereka.`,
      )
    ) {
      return;
    }
    setError("");
    setDeletingConversationId(conversationId);
    setOpenMenuId(null);
    try {
      await hideAllDirectMessages(conversationId);
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== conversationId),
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chat gagal disembunyikan dari inbox Anda.",
      );
    } finally {
      setDeletingConversationId(null);
    }
  }

  useEffect(() => {
    let active = true;
    let channel: ReturnType<
      ReturnType<typeof createSupabaseBrowserClient>["channel"]
    > | undefined;
    async function subscribe() {
      setSupabaseBrowserAccessTokenProvider(getToken);
      const supabase = createSupabaseBrowserClient();
      channel = supabase
        .channel("direct-message-inbox")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "direct_messages",
            filter: `recipient_id=eq.${currentUserId}`,
          },
          () => router.refresh(),
        )
        .subscribe((status, subscriptionError) => {
          if (
            active &&
            (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          ) {
            setError(
              subscriptionError?.message ??
                "Pembaruan inbox realtime gagal tersambung.",
            );
          }
        });
    }

    subscribe().catch((cause: unknown) => {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Pembaruan inbox realtime gagal tersambung.",
        );
      }
    });

    return () => {
      active = false;
      if (channel) void createSupabaseBrowserClient().removeChannel(channel);
    };
  }, [currentUserId, getToken, router]);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-medium text-cyan-300">COMMUNITY / DIRECT</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Chat pribadi
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Percakapan satu lawan satu dengan anggota Artem Geng.
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h2 className="text-sm font-medium text-slate-300">Semua chat</h2>
        {unreadTotal > 0 && (
          <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300">
            {unreadTotal} belum dibaca
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0c1526]/70 px-5 py-14 text-center">
          <Mail className="mx-auto size-8 text-slate-500" />
          <h2 className="mt-4 font-medium text-slate-200">Belum ada chat pribadi</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Buka profil anggota dari nama mereka di chat komunitas atau daftar
            task, lalu pilih Chat pribadi untuk memulai percakapan.
          </p>
          <Link
            href="/chat"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[.05]"
          >
            <MessageCircle className="size-4" /> Buka Chat Room
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <article
              key={conversation.id}
              role="link"
              tabIndex={0}
              aria-label={`Buka chat dengan ${conversation.other_member.full_name}`}
              onClick={() => router.push(`/messages/${conversation.id}`)}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  router.push(`/messages/${conversation.id}`);
                }
              }}
              className="relative flex min-w-0 items-center gap-3 rounded-2xl border border-white/[.08] bg-[#0c1526] p-3.5 transition hover:border-cyan-300/20 hover:bg-[#101d32] sm:gap-4 sm:p-4"
            >
              <MemberAvatar
                name={conversation.other_member.full_name}
                avatar={conversation.other_member.avatar_url}
              />
              <div className="min-w-0 flex-1">
                <div>
                  <span className="truncate text-sm font-semibold text-slate-100">
                    {conversation.other_member.full_name}
                  </span>
                </div>
                <div className="mt-1 block truncate text-xs text-slate-400">
                  {conversation.latest_message
                    ? `${conversation.latest_message.sender_id === currentUserId ? "Anda: " : ""}${conversation.latest_message.content}`
                    : "Belum ada pesan. Mulai percakapan ini."}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {conversation.latest_message && (
                  <time className="text-[10px] text-slate-500">
                    {new Intl.DateTimeFormat("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(conversation.latest_message.created_at))}
                  </time>
                )}
                {conversation.unread_count > 0 ? (
                  <span
                    aria-label={`${conversation.unread_count} pesan belum dibaca`}
                    className="flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-red-950/40"
                  >
                    {conversation.unread_count}
                  </span>
                ) : (
                  <ArrowRight className="size-4 text-slate-600" />
                )}
              </div>
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label={`Opsi chat dengan ${conversation.other_member.full_name}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === conversation.id}
                  disabled={deletingConversationId === conversation.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenMenuId((current) =>
                      current === conversation.id ? null : conversation.id,
                    );
                  }}
                  className="flex size-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[.06] hover:text-white disabled:opacity-50"
                >
                  {deletingConversationId === conversation.id ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <EllipsisVertical className="size-5" />
                  )}
                </button>
                {openMenuId === conversation.id && (
                  <div
                    role="menu"
                    className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-white/10 bg-[#101c30] p-1.5 shadow-xl shadow-black/30"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleHideConversation(conversation.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-400/10"
                    >
                      <Trash2 className="size-4" />
                      Hapus semua chat
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MemberAvatar({ name, avatar }: { name: string; avatar: string | null }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
  return avatar ? (
    // Member avatars are externally hosted profile images.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatar}
      alt=""
      className="size-11 shrink-0 rounded-full border border-white/10 object-cover"
    />
  ) : (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-xs font-bold text-white">
      {initials || "AG"}
    </span>
  );
}
