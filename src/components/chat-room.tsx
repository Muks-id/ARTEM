"use client";

import { useAuth } from "@clerk/nextjs";
import { markCommunityChatRead } from "@/app/actions";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, Hash, LoaderCircle, Send, X } from "lucide-react";
import { deleteCommunityMessage, sendCommunityMessage } from "@/app/actions";
import ChatComposerTools from "@/components/chat-composer-tools";
import {
  createSupabaseBrowserClient,
  setSupabaseBrowserAccessTokenProvider,
} from "@/lib/supabase-browser";
import type {
  ChatMessage,
  MessageReaction,
  Profile,
} from "@/lib/portal-types";
import ChatMessageBubble from "@/components/chat-message-bubble";
import MemberProfilePopover from "@/components/member-profile-popover";

export default function ChatRoom({
  initialMessages,
  currentUserId,
  adminUserIds,
  memberCount,
}: {
  initialMessages: ChatMessage[];
  currentUserId: string;
  adminUserIds: string[];
  memberCount: number;
}) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<
      ReturnType<typeof createSupabaseBrowserClient>["channel"]
    > | undefined;

    async function connect() {
      setSupabaseBrowserAccessTokenProvider(getToken);
      const supabase = createSupabaseBrowserClient();
      try {
        await markCommunityChatRead();
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Gagal menandai chat room telah dibuka.",
          );
        }
      }
      if (!active) return;

      channel = supabase
        .channel("artem-geng-community-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const row = payload.new as {
              id: string;
              sender_id: string;
              content: string;
              created_at: string;
              reply_to_id: string | null;
              attachment_name: string | null;
              attachment_expires_at: string | null;
              attachment_downloaded_at: string | null;
            };
            const { data: sender, error: senderError } = await supabase
              .from("member_directory")
              .select("id, full_name, username, avatar_url, bio")
              .eq("id", row.sender_id)
              .single();
            if (senderError) {
              setError(`Pesan masuk, tetapi profil pengirim gagal dimuat: ${senderError.message}`);
              return;
            }
            const nextMessage: ChatMessage = {
              ...row,
              sender: {
                ...(sender as Pick<Profile, "id" | "full_name" | "username" | "avatar_url" | "bio">),
                is_admin: adminUserIds.includes(row.sender_id),
              },
              reply_to: null,
              reactions: [],
              attachment_name: row.attachment_name,
              attachment_expires_at: row.attachment_expires_at,
              attachment_downloaded_at: row.attachment_downloaded_at,
            };
            if (row.sender_id !== currentUserId) {
              markCommunityChatRead().catch((cause: unknown) => {
                setError(
                  cause instanceof Error
                    ? `Gagal memperbarui status baca chat room: ${cause.message}`
                    : "Gagal memperbarui status baca chat room.",
                );
              });
            }
            setMessages((current) => {
              if (current.some((item) => item.id === nextMessage.id)) {
                return current;
              }
              const quoted = current.find((item) => item.id === row.reply_to_id);
              return [
                ...current,
                {
                  ...nextMessage,
                  reply_to: quoted
                    ? {
                        id: quoted.id,
                        content: quoted.content,
                        sender: quoted.sender,
                      }
                    : null,
                },
              ];
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "messages" },
          (payload) => {
            const deletedId = payload.old.id;
            if (typeof deletedId !== "string") return;
            setMessages((current) =>
              current
                .filter((message) => message.id !== deletedId)
                .map((message) =>
                  message.reply_to?.id === deletedId
                    ? { ...message, reply_to: null }
                    : message,
                ),
            );
            setReplyTarget((current) =>
              current?.id === deletedId ? null : current,
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "message_reactions" },
          (payload) => {
            const reaction = (
              payload.eventType === "DELETE" ? payload.old : payload.new
            ) as MessageReaction;
            setMessages((current) =>
              current.map((message) => {
                if (message.id !== reaction.message_id) return message;
                const exists = message.reactions.some(
                  (item) =>
                    item.user_id === reaction.user_id &&
                    item.emoji === reaction.emoji,
                );
                if (payload.eventType === "DELETE") {
                  return {
                    ...message,
                    reactions: message.reactions.filter(
                      (item) =>
                        !(
                          item.user_id === reaction.user_id &&
                          item.emoji === reaction.emoji
                        ),
                    ),
                  };
                }
                return exists
                  ? message
                  : {
                      ...message,
                      reactions: [...message.reactions, reaction],
                    };
              }),
            );
          },
        )
        .subscribe((status, subscriptionError) => {
          if (status === "SUBSCRIBED") setConnected(true);
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnected(false);
            setError(
              subscriptionError?.message ??
                "Koneksi chat realtime terputus. Periksa konfigurasi Supabase Realtime.",
            );
          }
        });
    }

    connect().catch((cause: unknown) => {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Tidak dapat menghubungkan chat realtime.",
        );
      }
    });

    return () => {
      active = false;
      setConnected(false);
      if (channel) void createSupabaseBrowserClient().removeChannel(channel);
    };
  }, [getToken, adminUserIds, currentUserId]);

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = content.trim();
    if ((!message && !photo) || message.length > 2000) return;
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("content", message);
    formData.set("replyToId", replyTarget?.id ?? "");
    if (photo) formData.set("photo", photo);
    startTransition(async () => {
      try {
        await sendCommunityMessage(formData);
        setContent("");
        setPhoto(null);
        setReplyTarget(null);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Pesan gagal dikirim.",
        );
      }
    });
  }

  async function handleReaction(message: ChatMessage, emoji: string) {
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const alreadyReacted = message.reactions.some(
        (reaction) =>
          reaction.user_id === currentUserId && reaction.emoji === emoji,
      );
      const result = alreadyReacted
        ? await supabase
            .from("message_reactions")
            .delete()
            .eq("message_id", message.id)
            .eq("user_id", currentUserId)
            .eq("emoji", emoji)
        : await supabase.from("message_reactions").insert({
            message_id: message.id,
            user_id: currentUserId,
            emoji,
          });

      if (result.error) {
        setError(`Reaction gagal disimpan: ${result.error.message}`);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Reaction gagal disimpan: ${cause.message}`
          : "Reaction gagal disimpan karena kesalahan yang tidak diketahui.",
      );
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!window.confirm("Hapus pesan ini dari Chat Room untuk semua anggota?")) {
      return;
    }
    setError("");
    setDeletingMessageId(messageId);
    try {
      await deleteCommunityMessage(messageId);
      setMessages((current) =>
        current
          .filter((message) => message.id !== messageId)
          .map((message) =>
            message.reply_to?.id === messageId
              ? { ...message, reply_to: null }
              : message,
          ),
      );
      setReplyTarget((current) =>
        current?.id === messageId ? null : current,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Pesan Chat Room gagal dihapus.",
      );
    } finally {
      setDeletingMessageId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div>
        <p className="text-sm font-medium text-cyan-300">COMMUNITY / CHAT</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Chat Room
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Ngobrol, berbagi kabar, dan tetap terhubung dengan komunitas.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c1526]">
        <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200">
              <Hash className="size-5" />
            </span>
            <div>
              <div className="font-medium">obrolan-anggota</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {memberCount} anggota terdaftar
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[.07] px-3 py-1.5 text-xs text-slate-400">
            <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
            Realtime
          </span>
        </div>

        <div className="h-[min(60vh,600px)] min-h-80 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-200">
                <ArrowDown className="size-5" />
              </span>
              <p className="mt-4 font-medium text-slate-200">Mulai obrolan</p>
              <p className="mt-1 text-sm text-slate-500">
                Jadilah yang pertama menyapa komunitas Artem Geng.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message) => {
                const ownMessage = message.sender_id === currentUserId;
              return (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    ownMessage={ownMessage}
                    currentUserId={currentUserId}
                    onReact={(emoji) => void handleReaction(message, emoji)}
                    onReply={() => setReplyTarget(message)}
                    onDelete={
                      adminUserIds.includes(currentUserId)
                        ? () => void handleDeleteMessage(message.id)
                        : undefined
                    }
                    deleting={deletingMessageId === message.id}
                  />
              );
            })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/[.07] p-4 sm:px-6">
          {replyTarget && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-300/20 bg-blue-300/[.07] px-3 py-2">
              <div className="min-w-0 border-l-2 border-cyan-300/70 pl-3">
                <p className="text-xs font-semibold text-cyan-200">
                  Membalas{" "}
                  <MemberProfilePopover
                    profile={replyTarget.sender}
                    side="top"
                    viewerId={currentUserId}
                  >
                    <span className="font-semibold text-cyan-100">
                      {replyTarget.sender.full_name}
                    </span>
                  </MemberProfilePopover>
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {replyTarget.content}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                aria-label="Batalkan balasan"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}
          <form onSubmit={handleSend}>
            <div className="flex items-end gap-3">
              <textarea
                value={content}
                maxLength={2000}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Tulis pesan untuk komunitas..."
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-white/10 bg-[#080e1c] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
              />
              <button
                disabled={(!content.trim() && !photo) || isPending}
                aria-label="Kirim pesan"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
            <ChatComposerTools
              photo={photo}
              onPhotoChange={setPhoto}
              onEmoji={(emoji) => setContent((value) => value + emoji)}
              disabled={isPending}
            />
          </form>
          <p className="mt-2 text-[11px] text-slate-600">
            Enter untuk mengirim · Shift + Enter untuk baris baru
          </p>
        </div>
      </section>
    </div>
  );
}
