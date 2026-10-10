"use client";

import { useState } from "react";
import { LoaderCircle, MessageCircleReply, SmilePlus, Trash2 } from "lucide-react";
import type { ChatMessage, MessageReaction } from "@/lib/portal-types";
import MemberProfilePopover from "@/components/member-profile-popover";
import ChatPhotoAttachment from "@/components/chat-photo-attachment";

const reactionChoices = ["👍", "❤️", "😂", "🎉", "👏", "🔥"];

export default function ChatMessageBubble({
  message,
  ownMessage,
  currentUserId,
  onReact,
  onReply,
  onDelete,
  deleting = false,
}: {
  message: ChatMessage;
  ownMessage: boolean;
  currentUserId: string;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const grouped = new Map<string, MessageReaction[]>();
  for (const reaction of message.reactions) {
    const current = grouped.get(reaction.emoji) ?? [];
    current.push(reaction);
    grouped.set(reaction.emoji, current);
  }

  const initials = message.sender.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");

  return (
    <div
      className={`flex min-w-0 items-start gap-3 ${
        ownMessage ? "flex-row-reverse" : ""
      }`}
    >
      <Avatar
        name={message.sender.full_name}
        initials={initials}
        avatar={message.sender.avatar_url}
      />
      <article
        className="chat-glass-bubble relative min-w-0 max-w-[min(82%,38rem)] rounded-[26px] px-4 py-3.5 text-left sm:px-5"
      >
        <div className="relative z-[1]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <MemberProfilePopover
              profile={message.sender}
              viewerId={currentUserId}
            >
              <span className="truncate text-sm font-semibold text-slate-100">
                {message.sender.full_name}
              </span>
            </MemberProfilePopover>
          </div>

          {message.reply_to && (
            <div className="mt-2 rounded-xl border-l-2 border-sky-300/60 bg-black/20 px-3 py-2">
              <MemberProfilePopover
                profile={message.reply_to.sender}
                viewerId={currentUserId}
              >
                <span className="text-[11px] font-semibold text-slate-100">
                  {message.reply_to.sender.full_name}
                </span>
              </MemberProfilePopover>
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
              isDirect={false}
              fileName={message.attachment_name}
              expiresAt={message.attachment_expires_at}
              downloadedAt={message.attachment_downloaded_at}
            />
          )}

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-white/15 pt-2.5">
            {grouped.size > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {[...grouped.entries()].map(([emoji, reactions]) => {
                  const selected = reactions.some((item) => item.user_id === currentUserId);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onReact(emoji)}
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
                })}
              </div>
            )}

            <time
              dateTime={message.created_at}
              className="ml-auto text-[10px] tabular-nums text-slate-400"
            >
              {new Intl.DateTimeFormat("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(message.created_at))}
            </time>

            <div className="relative flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPicker((visible) => !visible)}
                aria-label="Tambahkan reaction"
                aria-expanded={showPicker}
                className="flex size-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/15 hover:text-white"
              >
                <SmilePlus className="size-4" />
              </button>
              <button
                type="button"
                onClick={onReply}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-medium text-slate-100 transition hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/20"
              >
                <MessageCircleReply className="size-3.5" />
                Balas
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  aria-label="Hapus pesan sebagai admin"
                  title="Hapus pesan untuk semua anggota"
                  className="flex size-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-400/15 hover:text-red-200 disabled:opacity-50"
                >
                  {deleting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              )}
              {showPicker && (
                <div
                  role="group"
                  aria-label="Pilih emoji reaction"
                  className="absolute bottom-10 right-0 z-20 flex gap-1 rounded-2xl border border-white/70 bg-[#eff8ff]/95 p-2 shadow-xl shadow-blue-950/15 backdrop-blur-xl"
                >
                  {reactionChoices.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onReact(emoji);
                        setShowPicker(false);
                      }}
                      aria-label={`React ${emoji}`}
                      className="flex size-9 items-center justify-center rounded-xl text-lg transition hover:scale-125 hover:bg-blue-100"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function Avatar({
  name,
  initials,
  avatar,
}: {
  name: string;
  initials: string;
  avatar: string | null;
}) {
  return avatar ? (
    // Member avatars are externally hosted profile images.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatar}
      alt={name}
      className="size-10 shrink-0 rounded-full border border-white/80 object-cover shadow-md shadow-blue-900/10"
    />
  ) : (
    <span
      aria-label={name}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/70 bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-500 text-xs font-bold text-white shadow-lg shadow-blue-900/20"
    >
      {initials || "AG"}
    </span>
  );
}
