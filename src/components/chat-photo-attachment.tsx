"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { downloadChatPhoto, getChatPhotoPreviewUrl } from "@/app/actions";
import { Download, LoaderCircle } from "lucide-react";

export default function ChatPhotoAttachment({
  messageId,
  isDirect,
  fileName,
  expiresAt,
  downloadedAt,
}: {
  messageId: string;
  isDirect: boolean;
  fileName: string | null;
  expiresAt: string | null;
  downloadedAt: string | null;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(Boolean(downloadedAt));
  const [clock, setClock] = useState(Date.now());
  const [isPending, startTransition] = useTransition();
  const expired = !downloaded && expiresAt
    ? clock > Date.parse(expiresAt)
    : false;

  useEffect(() => {
    if (expired) return;
    if (downloaded || !expiresAt) return;
    const timeout = window.setTimeout(
      () => setClock(Date.now()),
      Math.max(0, Date.parse(expiresAt) - Date.now() + 100),
    );
    return () => window.clearTimeout(timeout);
  }, [downloaded, expired, expiresAt]);

  useEffect(() => {
    if (expired) return;
    let active = true;
    getChatPhotoPreviewUrl(messageId, isDirect)
      .then((signedUrl) => {
        if (active) setUrl(signedUrl);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Foto gagal dimuat.");
        }
      });
    return () => {
      active = false;
    };
  }, [downloaded, expired, isDirect, messageId]);

  function handleDownload() {
    setError("");
    startTransition(async () => {
      try {
        const signedUrl = await downloadChatPhoto(messageId, isDirect);
        setDownloaded(true);
        window.location.assign(signedUrl);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Foto gagal diunduh.");
      }
    });
  }

  if (expired) {
    return (
      <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-xs text-amber-200">
        Foto belum diunduh dan sudah kedaluwarsa.
      </p>
    );
  }

  return (
    <div className="mt-2 max-w-sm">
      {url ? (
        <Image
          src={url}
          alt={fileName ? `Foto: ${fileName}` : "Foto lampiran"}
          width={640}
          height={480}
          unoptimized
          className="max-h-80 w-auto rounded-xl border border-white/10 object-contain"
        />
      ) : (
        !error && (
          <div className="flex h-24 items-center justify-center rounded-xl border border-white/10 bg-black/10">
            <LoaderCircle className="size-5 animate-spin text-slate-400" />
          </div>
        )
      )}
      {error && <p role="alert" className="mt-1 text-xs text-amber-200">{error}</p>}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPending}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/[.06] disabled:opacity-50"
      >
        {isPending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Unduh foto
      </button>
    </div>
  );
}
