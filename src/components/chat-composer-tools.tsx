"use client";

import { ImagePlus, Smile, X } from "lucide-react";
import { useRef, useState } from "react";

const emojiChoices = [
  "😀", "😂", "🥹", "😍", "😎", "😭", "😅", "🤔",
  "👍", "👎", "👏", "🙏", "🔥", "❤️", "💙", "🎉",
  "✅", "🚀", "☕", "💪", "👀", "🤝", "🥳", "✨",
];

export default function ChatComposerTools({
  photo,
  onPhotoChange,
  onEmoji,
  disabled,
}: {
  photo: File | null;
  onPhotoChange: (file: File | null) => void;
  onEmoji: (emoji: string) => void;
  disabled: boolean;
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <div className="relative">
        <button
          type="button"
          aria-label="Pilih emoji"
          aria-expanded={emojiPickerOpen}
          onClick={() => setEmojiPickerOpen((open) => !open)}
          disabled={disabled}
          className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/[.06] hover:text-cyan-200 disabled:opacity-50"
        >
          <Smile className="size-4" />
        </button>
        {emojiPickerOpen && (
          <div className="absolute bottom-11 left-0 z-20 grid w-56 grid-cols-8 gap-1 rounded-xl border border-white/10 bg-[#101c30] p-2 shadow-2xl">
            {emojiChoices.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onEmoji(emoji);
                  setEmojiPickerOpen(false);
                }}
                aria-label={`Tambahkan emoji ${emoji}`}
                className="flex size-7 items-center justify-center rounded-md text-lg transition hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          onPhotoChange(event.currentTarget.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        aria-label="Lampirkan foto"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/[.06] hover:text-cyan-200 disabled:opacity-50"
      >
        <ImagePlus className="size-4" />
      </button>
      {photo && (
        <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[.06] px-2.5 py-1.5 text-xs text-cyan-100">
          <span className="max-w-48 truncate">{photo.name}</span>
          <button
            type="button"
            aria-label="Hapus foto terpilih"
            onClick={() => onPhotoChange(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </span>
      )}
      <span className="text-[11px] text-slate-600">Foto maks. 4 MB · tersimpan 3 hari jika belum diunduh</span>
    </div>
  );
}
