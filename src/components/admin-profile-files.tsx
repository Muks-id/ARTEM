"use client";

import { useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import type { AdminProfileFile } from "@/lib/portal-types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminProfileFiles({
  files,
}: {
  files: AdminProfileFile[];
}) {
  const [search, setSearch] = useState("");
  const photoFiles = useMemo(() => files.filter((file) => file.content_type.startsWith("image/")), [files]);
  const pdfFiles = useMemo(() => files.filter((file) => file.content_type === "application/pdf"), [files]);
  const filterFiles = (items: AdminProfileFile[]) => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((file) =>
      [file.file_name, file.owner_name]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  };
  const visiblePhotos = filterFiles(photoFiles);
  const visiblePdfs = filterFiles(pdfFiles);

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-cyan-300">PRIVATE STORAGE</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            File pribadi anggota
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {files.length} file yang diunggah anggota
          </p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari file atau anggota"
            aria-label="Cari file pribadi anggota"
            className="h-11 w-full rounded-xl border border-white/[.08] bg-[#0c1526] pl-10 pr-4 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
          />
        </div>
      </div>

      <Tabs defaultValue="foto">
        <TabsList className="grid h-11 w-full grid-cols-2 sm:w-80">
          <TabsTrigger value="foto" className="gap-2">
            <ImageIcon className="size-4" />
            Foto <span className="text-xs text-slate-500">{photoFiles.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-2">
            <FileText className="size-4" />
            PDF <span className="text-xs text-slate-500">{pdfFiles.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="foto" className="mt-5">
          {visiblePhotos.length === 0 ? (
            <EmptyFilesState
              icon="foto"
              message={
                photoFiles.length
                  ? "Tidak ada foto yang cocok."
                  : "Belum ada foto yang diunggah."
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visiblePhotos.map((file) => (
                <article
                  key={file.id}
                  className="min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-[#0c1526]"
                >
                  <a
                    href={`/api/profile-files/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Buka foto ${file.file_name}`}
                    className="block aspect-square overflow-hidden bg-black/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/profile-files/${file.id}`}
                      alt={file.file_name}
                      loading="lazy"
                      className="size-full object-cover transition duration-300 hover:scale-105"
                    />
                  </a>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {file.file_name}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {file.owner_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatFileSize(file.size_bytes)} · {formatDate(file.created_at)}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <a
                        href={`/api/profile-files/${file.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
                      >
                        <ExternalLink className="size-3.5" />
                        Buka
                      </a>
                      <a
                        href={`/api/profile-files/${file.id}?download=1`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
                      >
                        <Download className="size-3.5" />
                        Unduh
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="pdf" className="mt-5">
          {visiblePdfs.length === 0 ? (
            <EmptyFilesState
              icon="pdf"
              message={
                pdfFiles.length
                  ? "Tidak ada file PDF yang cocok."
                  : "Belum ada file PDF yang diunggah."
              }
            />
          ) : (
            <div className="divide-y divide-white/[.07] border-y border-white/[.07]">
              {visiblePdfs.map((file) => (
                <article
                  key={file.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <FileText className="hidden size-5 shrink-0 text-cyan-200 sm:block" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {file.file_name}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {file.owner_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatFileSize(file.size_bytes)} · {formatDate(file.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/profile-files/${file.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
                    >
                      <ExternalLink className="size-3.5" />
                      Buka
                    </a>
                    <a
                      href={`/api/profile-files/${file.id}?download=1`}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
                    >
                      <Download className="size-3.5" />
                      Unduh
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function EmptyFilesState({
  icon,
  message,
}: {
  icon: "foto" | "pdf";
  message: string;
}) {
  const Icon = icon === "foto" ? ImageIcon : FileText;
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center">
      <Icon className="mx-auto size-7 text-slate-600" />
      <p className="mt-3 text-sm text-slate-400">{message}</p>
    </div>
  );
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
}