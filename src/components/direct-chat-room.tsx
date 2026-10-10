"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCheck,
  LoaderCircle,
  MessageCircleReply,
  SmilePlus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  hideDirectMessage,
  deleteOwnDirectMessage,
  markDirectConversationRead,
  sendDirectMessage,
} from "@/app/actions";
import ChatComposerTools from "@/components/chat-composer-tools";
import ChatPhotoAttachment from "@/components/chat-photo-attachment";
import {
  createSupabaseBrowserClient,
  setSupabaseBrowserAccessTokenProvider,
} from "@/lib/supabase-browser";
import { useAuth } from "@clerk/nextjs";
import type {
  DirectMessage,
  DirectMessageWithSender,
  MessageReaction,
  MemberProfileSummary,
} from "@/lib/portal-types";

const reactionChoices = ["👍", "❤️", "😂", "🎉", "👏", "🔥"];

export default function DirectChatRoom({
  conversationId,
  currentUserId,
  currentMember,
  otherMember,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  currentMember: MemberProfileSummary;
  otherMember: MemberProfileSummary;
  initialMessages: DirectMessageWithSender[];
}) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [replyTarget, setReplyTarget] = useState<DirectMessageWithSender | null>(
    null,
  );
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<
    string | null
  >(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      channel = supabase
        .channel(`direct-conversation-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "direct_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            const row = (payload.eventType === "DELETE"
              ? payload.old
              : payload.new) as DirectMessage;

            if (payload.eventType === "INSERT") {
              const sender =
                row.sender_id === currentUserId ? currentMember : otherMember;
              let nextMessage: DirectMessageWithSender = {
                ...row,
                sender,
                reply_to: null,
                reactions: [],
              };

              if (row.recipient_id === currentUserId) {
                const readAt = new Date().toISOString();
                const { error: readError } = await supabase
                  .from("direct_messages")
                  .update({ read_at: readAt })
                  .eq("id", row.id)
                  .eq("recipient_id", currentUserId);
                if (readError) {
                  setError(`Gagal menandai pesan telah dilihat: ${readError.message}`);
                } else {
                  nextMessage = { ...nextMessage, read_at: readAt };
                }
              }
              setMessages((current) => {
                const existing = current.find(
                  (message) => message.id === nextMessage.id,
                );
                if (existing) {
                  return current.map((message) =>
                    message.id === nextMessage.id
                      ? { ...message, read_at: nextMessage.read_at }
                      : message,
                  );
                }
                const quoted = current.find(
                  (message) => message.id === row.reply_to_id,
                );
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
              return;
            }

            if (payload.eventType === "UPDATE") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === row.id
                    ? {
                        ...message,
                        read_at: row.read_at,
                        reply_to_id: row.reply_to_id,
                      }
                    : message,
                ),
              );
            }
            if (payload.eventType === "DELETE") {
              setMessages((current) =>
                current
                  .filter((message) => message.id !== row.id)
                  .map((message) =>
                    message.reply_to?.id === row.id
                      ? { ...message, reply_to: null, reply_to_id: null }
                      : message,
                  ),
              );
              setReplyTarget((current) =>
                current?.id === row.id ? null : current,
              );
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "direct_message_reactions",
          },
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
                "Koneksi chat pribadi terputus. Periksa konfigurasi Supabase Realtime.",
            );
          }
        });
      try {
        await markDirectConversationRead(conversationId);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Gagal menandai pesan telah dilihat.",
          );
        }
      }
    }

    connect().catch((cause: unknown) => {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Tidak dapat menghubungkan chat pribadi.",
        );
      }
    });

    return () => {
      active = false;
      setConnected(false);
      if (channel) void createSupabaseBrowserClient().removeChannel(channel);
    };
  }, [conversationId, currentMember, currentUserId, getToken, otherMember]);

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = content.trim();
    if ((!message && !photo) || message.length > 2000) return;
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("content", message);
    formData.set("conversationId", conversationId);
    formData.set("replyToId", replyTarget?.id ?? "");
    if (photo) formData.set("photo", photo);
    startTransition(async () => {
      try {
        const data = await sendDirectMessage(formData);
        const sentMessage: DirectMessage = {
          ...data,
          attachment_downloaded_at: data.attachment_downloaded_at ?? null,
        };
        setMessages((current) =>
          current.some((item) => item.id === sentMessage.id)
            ? current
            : [
                ...current,
                {
                  ...sentMessage,
                  sender: currentMember,
                  reply_to: replyTarget
                    ? {
                        id: replyTarget.id,
                        content: replyTarget.content,
                        sender: replyTarget.sender,
                      }
                    : null,
                  reactions: [],
                },
              ],
        );
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

  async function handleReaction(message: DirectMessageWithSender, emoji: string) {
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const alreadyReacted = message.reactions.some(
        (reaction) =>
          reaction.user_id === currentUserId && reaction.emoji === emoji,
      );
      const result = alreadyReacted
        ? await supabase
            .from("direct_message_reactions")
            .delete()
            .eq("message_id", message.id)
            .eq("user_id", currentUserId)
            .eq("emoji", emoji)
        : await supabase.from("direct_message_reactions").insert({
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

  async function handleHide(messageId: string) {
    setError("");
    setDeletingId(messageId);
    try {
      await hideDirectMessage(messageId);
      setMessages((current) => current.filter((item) => item.id !== messageId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Pesan gagal disembunyikan dari tampilan Anda.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteOwnMessage(messageId: string) {
    if (
      !window.confirm(
        "Hapus pesan ini untuk Anda dan penerima? Pesan tidak dapat dipulihkan.",
      )
    ) {
      return;
    }
    setError("");
    setDeletingId(messageId);
    try {
      await deleteOwnDirectMessage(messageId);
      setMessages((current) =>
        current
          .filter((item) => item.id !== messageId)
          .map((item) =>
            item.reply_to?.id === messageId
              ? { ...item, reply_to: null, reply_to_id: null }
              : item,
          ),
      );
      setReplyTarget((current) => (current?.id === messageId ? null : current));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Pesan pribadi gagal dihapus.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/messages"
          aria-label="Kembali ke inbox chat pribadi"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/[.05] hover:text-white"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Avatar name={otherMember.full_name} avatar={otherMember.avatar_url} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-base font-semibold text-slate-100">
              {otherMember.full_name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className={`size-1.5 rounded-full ${
                connected ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            Realtime
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c1526]">
        <div className="h-[min(62vh,640px)] min-h-80 overflow-y-auto px-3 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Avatar
                name={otherMember.full_name}
                avatar={otherMember.avatar_url}
                large
              />
              <span className="mt-3 text-sm font-semibold text-slate-200">
                {otherMember.full_name}
              </span>
              <p className="mt-1 text-sm text-slate-500">
                Mulai percakapan pribadi.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const ownMessage = message.sender_id === currentUserId;
                const groupedReactions = new Map<
                  string,
                  MessageReaction[]
                >();
                for (const reaction of message.reactions) {
                  const grouped = groupedReactions.get(reaction.emoji) ?? [];
                  grouped.push(reaction);
                  groupedReactions.set(reaction.emoji, grouped);
                }
                return (
                  <div
                    key={message.id}
                    className={`flex min-w-0 items-start gap-3 ${
                      ownMessage ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Avatar
                      name={message.sender.full_name}
                      avatar={message.sender.avatar_url}
                    />
                    <article
                      className="chat-glass-bubble relative min-w-0 max-w-[min(82%,38rem)] rounded-[26px] px-4 py-3.5 text-left sm:px-5"
                    >
                      <div className="relative z-[1]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100">
                            {message.sender.full_name}
                          </span>
                        </div>
                        {message.reply_to && (
                          <div className="mt-2 rounded-xl border-l-2 border-sky-300/60 bg-black/20 px-3 py-2">
                            <span className="text-[11px] font-semibold text-slate-100">
                              {message.reply_to.sender.full_name}
                            </span>
                            <p className="mt-0.5 line-clamp-2 break-words text-xs text-slate-300">
                              {message.reply_to.content}
                            </p>
                          </div>
                        )}
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                          {message.content}
                        </p>
                        {message.attachment_name && (
                          <ChatPhotoAttachment
                            messageId={message.id}
                            isDirect
                            fileName={message.attachment_name}
                            expiresAt={message.attachment_expires_at}
                            downloadedAt={message.attachment_downloaded_at}
                          />
                        )}
                        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-white/15 pt-2">
                          {groupedReactions.size > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {[...groupedReactions.entries()].map(
                                ([emoji, reactions]) => {
                                  const selected = reactions.some(
                                    (reaction) =>
                                      reaction.user_id === currentUserId,
                                  );
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() =>
                                        void handleReaction(message, emoji)
                                      }
                                      aria-label={`${emoji}, ${reactions.length} reaction`}
                                      aria-pressed={selected}
                                      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition hover:-translate-y-0.5 ${
                                        selected
                                          ? "border-sky-200/50 bg-sky-200/20 shadow-sm"
                                          : "border-white/20 bg-white/10 hover:bg-white/20"
                                      }`}
                                    >
                                      <span>{emoji}</span>
                                      <span className="font-semibold text-slate-100">
                                        {reactions.length}
                                      </span>
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          )}
                          <time
                            dateTime={message.created_at}
                            className="ml-auto text-[10px] tabular-nums text-slate-400"
                          >
                            {new Intl.DateTimeFormat("id-ID", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(message.created_at))}
                          </time>
                          {ownMessage && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] ${
                                message.read_at
                                  ? "text-cyan-200"
                                  : "text-slate-500"
                              }`}
                              title={
                                message.read_at
                                  ? "Pesan sudah dilihat"
                                  : "Pesan terkirim, belum dilihat"
                              }
                            >
                              <CheckCheck className="size-3.5" />
                              {message.read_at ? "Dilihat" : "Terkirim"}
                            </span>
                          )}
                          <div className="relative flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setReactionPickerMessageId((current) =>
                                  current === message.id ? null : message.id,
                                )
                              }
                              aria-label="Tambahkan reaction"
                              aria-expanded={
                                reactionPickerMessageId === message.id
                              }
                              className="flex size-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/15 hover:text-white"
                            >
                              <SmilePlus className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyTarget(message)}
                              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 text-[11px] font-medium text-slate-100 transition hover:bg-white/20"
                            >
                              <MessageCircleReply className="size-3.5" />
                              Balas
                            </button>
                            {reactionPickerMessageId === message.id && (
                              <div
                                role="group"
                                aria-label="Pilih emoji reaction"
                                className="absolute bottom-9 right-0 z-20 flex gap-1 rounded-2xl border border-white/20 bg-[#101b2e]/95 p-2 shadow-xl shadow-black/30 backdrop-blur-xl"
                              >
                                {reactionChoices.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      void handleReaction(message, emoji);
                                      setReactionPickerMessageId(null);
                                    }}
                                    aria-label={`React ${emoji}`}
                                    className="flex size-8 items-center justify-center rounded-xl text-lg transition hover:scale-125 hover:bg-white/10"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void (ownMessage
                                ? handleDeleteOwnMessage(message.id)
                                : handleHide(message.id))
                            }
                            disabled={deletingId === message.id}
                            aria-label={
                              ownMessage
                                ? "Hapus pesan untuk kedua pihak"
                                : "Sembunyikan pesan dari tampilan saya"
                            }
                            title={
                              ownMessage
                                ? "Hapus pesan untuk kedua pihak"
                                : "Sembunyikan hanya dari tampilan saya"
                            }
                            className="flex size-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
                          >
                            {deletingId === message.id ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/[.07] p-3 sm:px-5 sm:py-4">
          {replyTarget && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-300/20 bg-blue-300/[.07] px-3 py-2">
              <div className="min-w-0 border-l-2 border-cyan-300/70 pl-3">
                <p className="text-xs font-semibold text-cyan-200">
                  Membalas {replyTarget.sender.full_name}
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
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200"
            >
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
                placeholder={`Kirim pesan ke ${otherMember.full_name}...`}
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-white/10 bg-[#080e1c] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
              />
              <button
                disabled={(!content.trim() && !photo) || isPending}
                aria-label="Kirim pesan pribadi"
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
      </div>
    </section>
  );
}

function Avatar({
  name,
  avatar,
  large = false,
}: {
  name: string;
  avatar: string | null;
  large?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
  const className = large ? "size-14" : "size-10";
  return avatar ? (
    // Member avatars are externally hosted profile images.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatar}
      alt={name}
      className={`${className} shrink-0 rounded-full border border-white/10 object-cover`}
    />
  ) : (
    <span
      aria-label={name}
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-xs font-bold text-white`}
    >
      {initials || "AG"}
    </span>
  );
}
