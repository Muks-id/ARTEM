"use client";

import { useState, useTransition } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import {
  deletePersonalProfileFile,
  updateProfile,
  uploadPersonalProfileFile,
  uploadProfilePhoto,
} from "@/app/actions";
import type { Profile, ProfileFile, TaskStatus } from "@/lib/portal-types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProfileEditor({
  profile,
  counts,
  initialPersonalFiles,
}: {
  profile: Profile;
  counts: Record<TaskStatus, number>;
  initialPersonalFiles: ProfileFile[];
}) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [personalFiles, setPersonalFiles] = useState(initialPersonalFiles);
  const photoFiles = personalFiles.filter((file) =>
    file.content_type.startsWith("image/"),
  );
  const pdfFiles = personalFiles.filter(
    (file) => file.content_type === "application/pdf",
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    startTransition(async () => {
      try {
        await updateProfile({ fullName, username, bio });
        setFullName(fullName.trim());
        setUsername(username.trim().replace(/^@/, ""));
        setNotice("Profil berhasil diperbarui.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal memperbarui profil.");
      }
    });
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0];
    event.target.value = "";
    if (!photo) return;

    setNotice("");
    setError("");
    const formData = new FormData();
    formData.set("photo", photo);
    startTransition(async () => {
      try {
        const nextAvatarUrl = await uploadProfilePhoto(formData);
        setAvatarUrl(nextAvatarUrl);
        setNotice("Foto profil berhasil diperbarui.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal mengunggah foto.");
      }
    });
  }

  function handlePersonalFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setNotice("");
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      try {
        const uploaded = await uploadPersonalProfileFile(formData);
        setPersonalFiles((current) => [uploaded as ProfileFile, ...current]);
        setNotice("File pribadi berhasil diunggah.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "File gagal diunggah.");
      }
    });
  }

  function handleDeletePersonalFile(file: ProfileFile) {
    if (!window.confirm(`Hapus file "${file.file_name}" dari profil Anda?`)) return;

    setNotice("");
    setError("");
    startTransition(async () => {
      try {
        await deletePersonalProfileFile(file.id);
        setPersonalFiles((current) => current.filter((item) => item.id !== file.id));
        setNotice("File pribadi berhasil dihapus.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "File gagal dihapus.");
      }
    });
  }

  const summary = [
    {
      label: "Belum dikerjakan",
      count: counts.belum_dikerjakan,
      icon: Circle,
      color: "text-slate-300",
    },
    {
      label: "Sedang dikerjakan",
      count: counts.dikerjakan,
      icon: Clock3,
      color: "text-blue-200",
    },
    {
      label: "Selesai",
      count: counts.selesai,
      icon: CheckCircle2,
      color: "text-emerald-200",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-sm font-medium text-cyan-300">ACCOUNT / PROFILE</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Profile Saya
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Kelola informasi diri dan lihat progres pekerjaanmu.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c1526]">
        <div className="relative h-36 overflow-hidden bg-[#0c162b] sm:h-40">
          {/* Shared animated profile banner, identical for every member. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/profile-angry-work.gif.gif"
            alt="Ilustrasi animasi karyawan melempar dokumen dengan ekspresi kesal"
            className="h-full w-full object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c1526] via-[#0c1526]/45 to-transparent"
          />
        </div>
        <div className="relative z-10 px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
            {avatarUrl ? (
              // Profile photo may be hosted by Supabase Storage or Clerk.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName}
                className="size-24 rounded-2xl border-4 border-[#0c1526] object-cover"
              />
            ) : (
              <div className="flex size-24 items-center justify-center rounded-2xl border-4 border-[#0c1526] bg-indigo-400/15 text-3xl font-semibold text-indigo-200">
                {fullName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex flex-wrap items-end justify-between gap-4 pb-1 sm:flex-1">
              <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[.1] to-blue-400/[.06] px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold text-cyan-50">{fullName}</h2>
                </div>
                <div className="mt-1 text-sm text-blue-200">
                  {username ? `@${username.replace(/^@/, "")}` : "Username belum diatur"}
                </div>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100">
                {isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
                {isPending ? "Mengunggah..." : "Ganti foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isPending}
                  onChange={handlePhotoChange}
                  className="sr-only"
                  aria-label="Unggah foto profil"
                />
              </label>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/[.07] pt-5 text-sm text-slate-400">
            {bio && (
              <span className="inline-flex items-center gap-2">
                <UserRound className="size-4 text-slate-500" /> {bio}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-white/[.08] bg-[#0c1526] p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="font-semibold">Edit informasi</h2>
            <p className="mt-1 text-sm text-slate-500">
              Perbarui nama, username, dan bio profilmu.
            </p>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Nama lengkap</span>
              <input
                required
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nama lengkap"
                className="h-11 w-full rounded-xl border border-white/10 bg-[#080e1c] px-4 outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Username</span>
              <div className="flex h-11 items-center rounded-xl border border-white/10 bg-[#080e1c] px-3 focus-within:border-cyan-300/50">
                <span className="text-slate-500">@</span>
                <input
                  required
                  minLength={3}
                  maxLength={30}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="username"
                  className="h-full w-full bg-transparent px-2 outline-none placeholder:text-slate-600"
                />
              </div>
              <span className="block text-xs text-slate-600">
                3–30 karakter: huruf, angka, titik, _ atau -.
              </span>
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Bio / keterangan diri</span>
              <textarea
                value={bio}
                maxLength={240}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Contoh: Frontend Developer di Artem Geng"
                rows={4}
                className="w-full resize-y rounded-xl border border-white/10 bg-[#080e1c] px-4 py-3 outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
              />
              <span className="block text-right text-xs text-slate-600">
                {bio.length}/240
              </span>
            </label>
            {error && (
              <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
                {notice}
              </p>
            )}
            <button
              disabled={isPending}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              <Check className="size-4" />
              {isPending ? "Menyimpan..." : "Simpan perubahan"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/[.08] bg-[#0c1526] p-5 sm:p-6">
          <h2 className="font-semibold">Ringkasan pekerjaan</h2>
          <p className="mt-1 text-sm text-slate-500">
            Progres task yang kamu kelola.
          </p>
          <div className="mt-5 space-y-3">
            {summary.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-[#080e1c]/70 p-4"
                >
                  <Icon className={`size-5 ${item.color}`} />
                  <span className="flex-1 text-sm text-slate-300">{item.label}</span>
                  <span className="text-lg font-semibold text-slate-100">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-xl bg-blue-400/[.06] p-4 text-xs leading-5 text-slate-400">
            Alamat email akun tidak ditampilkan di halaman profil. Nama, username,
            bio, dan foto profil dapat kamu kelola di sini.
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/[.08] bg-[#0c1526] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">File pribadi</h2>
            <p className="mt-1 text-sm text-slate-500">
              PDF atau foto, maksimal 10 MB per file.
            </p>
          </div>
          <label className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 has-[:disabled]:cursor-wait has-[:disabled]:opacity-50">
            {isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Unggah file
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={isPending}
              onChange={handlePersonalFileChange}
              className="sr-only"
              aria-label="Unggah file pribadi PDF atau foto"
            />
          </label>
        </div>
        <Tabs defaultValue="foto" className="mt-5">
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
            {photoFiles.length === 0 ? (
              <EmptyFilesState icon="photo" message="Belum ada foto pribadi." />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photoFiles.map((file) => (
                  <article
                    key={file.id}
                    className="min-w-0 overflow-hidden rounded-xl border border-white/[.08] bg-[#080e1c]/70"
                  >
                    <a
                      href={`/api/profile-files/${file.id}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Buka foto ${file.file_name}`}
                      className="relative block aspect-square overflow-hidden bg-black/20"
                    >
                      {/* Private previews are served through the authenticated file endpoint. */}
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
                      <p className="mt-1 text-xs text-slate-500">
                        {formatFileSize(file.size_bytes)} · {formatDate(file.created_at)}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <a
                          href={`/api/profile-files/${file.id}?download=1`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
                        >
                          <Download className="size-3.5" />
                          Unduh
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeletePersonalFile(file)}
                          disabled={isPending}
                          aria-label={`Hapus ${file.file_name}`}
                          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:border-red-300/30 hover:text-red-300 disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="pdf" className="mt-5">
            {pdfFiles.length === 0 ? (
              <EmptyFilesState icon="pdf" message="Belum ada file PDF pribadi." />
            ) : (
              <ul className="divide-y divide-white/[.07]">
                {pdfFiles.map((file) => (
                  <li key={file.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                    <FileText className="hidden size-5 shrink-0 text-cyan-200 sm:block" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">{file.file_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
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
                      <button
                        type="button"
                        onClick={() => handleDeletePersonalFile(file)}
                        disabled={isPending}
                        aria-label={`Hapus ${file.file_name}`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-300/30 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function EmptyFilesState({
  icon,
  message,
}: {
  icon: "photo" | "pdf";
  message: string;
}) {
  const Icon = icon === "photo" ? ImageIcon : FileText;
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-4 py-9 text-center">
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
