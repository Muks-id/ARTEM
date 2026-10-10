"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  CheckCircle2,
  CheckSquare2,
  ClipboardList,
  Circle,
  Clock3,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { createTask, deleteTask, updateTask } from "@/app/actions";
import type { Task, TaskPosition, TaskStatus } from "@/lib/portal-types";
import MemberProfilePopover from "@/components/member-profile-popover";

const statuses: { value: TaskStatus; label: string }[] = [
  { value: "belum_dikerjakan", label: "Belum dikerjakan" },
  { value: "dikerjakan", label: "Dikerjakan" },
  { value: "selesai", label: "Selesai" },
];
const positions: { value: TaskPosition; label: string }[] = [
  { value: "drafter", label: "Drafter" },
  { value: "admin", label: "Admin" },
  { value: "supervisi", label: "Supervisi" },
];

const statusStyles: Record<TaskStatus, string> = {
  belum_dikerjakan: "border-slate-600/50 bg-slate-500/10 text-slate-300",
  dikerjakan: "border-blue-400/20 bg-blue-400/10 text-blue-200",
  selesai: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
};

export default function TaskManager({
  initialTasks,
  currentUserId,
  canDelete,
}: {
  initialTasks: Task[];
  currentUserId: string;
  canDelete: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [projectName, setProjectName] = useState("");
  const [title, setTitle] = useState("");
  const [position, setPosition] = useState<TaskPosition>("drafter");
  const [description, setDescription] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionDate, setRevisionDate] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [needsRevision, setNeedsRevision] = useState(false);
  const [newStatus, setNewStatus] = useState<TaskStatus>("belum_dikerjakan");
  const [filter, setFilter] = useState("semua");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPosition, setEditPosition] = useState<TaskPosition>("drafter");
  const [editDescription, setEditDescription] = useState("");
  const [editRevisionNotes, setEditRevisionNotes] = useState("");
  const [editRevisionDate, setEditRevisionDate] = useState("");
  const [editIsNew, setEditIsNew] = useState(false);
  const [editNeedsRevision, setEditNeedsRevision] = useState(false);
  const [editStatus, setEditStatus] = useState<TaskStatus>("belum_dikerjakan");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(
    () =>
      statuses.map((status) => ({
        ...status,
        count: tasks.filter((task) => task.status === status.value).length,
      })),
    [tasks],
  );
  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesStatus = filter === "semua" || task.status === filter;
        const term = search.trim().toLowerCase();
        return (
          matchesStatus &&
          (!term ||
            task.project_name.toLowerCase().includes(term) ||
            task.title.toLowerCase().includes(term) ||
            task.position.toLowerCase().includes(term) ||
            task.description.toLowerCase().includes(term) ||
            task.revision_notes.toLowerCase().includes(term))
        );
      }),
    [filter, search, tasks],
  );

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await createTask({
          projectName,
          title,
          position,
          description,
          status: newStatus,
          revisionNotes,
          revisionDate: revisionDate || null,
          isNew,
          needsRevision,
        });
        window.location.reload();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal membuat task.");
      }
    });
  }

  function beginEdit(task: Task) {
    setEditingId(task.id);
    setEditProjectName(task.project_name);
    setEditTitle(task.title);
    setEditPosition(task.position);
    setEditDescription(task.description);
    setEditRevisionNotes(task.revision_notes);
    setEditRevisionDate(task.revision_date ?? "");
    setEditIsNew(task.is_new);
    setEditNeedsRevision(task.needs_revision);
    setEditStatus(task.status);
  }

  function saveEdit(task: Task) {
    setError("");
    startTransition(async () => {
      try {
        const completedAt = await updateTask(task.id, {
          projectName: editProjectName,
          title: editTitle,
          position: editPosition,
          description: editDescription,
          status: editStatus,
          revisionNotes: editRevisionNotes,
          revisionDate: editRevisionDate || null,
          isNew: editIsNew,
          needsRevision: editNeedsRevision,
        });
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  project_name: editProjectName.trim(),
                  title: editTitle.trim(),
                  position: editPosition,
                  description: editDescription.trim(),
                  status: editStatus,
                  completed_at: completedAt,
                  revision_notes: editRevisionNotes.trim(),
                  revision_date: editRevisionDate || null,
                  is_new: editIsNew,
                  needs_revision: editNeedsRevision,
                }
              : item,
          ),
        );
        setEditingId(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal memperbarui task.");
      }
    });
  }

  function changeStatus(task: Task, status: TaskStatus) {
    setError("");
    startTransition(async () => {
      try {
        const completedAt = await updateTask(task.id, {
          projectName: task.project_name,
          title: task.title,
          position: task.position,
          description: task.description,
          status,
          revisionNotes: task.revision_notes,
          revisionDate: task.revision_date,
          isNew: task.is_new,
          needsRevision: task.needs_revision,
        });
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id ? { ...item, status, completed_at: completedAt } : item,
          ),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal mengubah status.");
      }
    });
  }

  function removeTask(id: string) {
    if (!window.confirm("Hapus task ini?")) return;
    setError("");
    startTransition(async () => {
      try {
        await deleteTask(id);
        setTasks((current) => current.filter((task) => task.id !== id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal menghapus task.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-cyan-300">WORKSPACE / TASK</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Daftar pekerjaan
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Susun pekerjaanmu, satu langkah dalam satu waktu.
          </p>
        </div>
        <div className="rounded-xl border border-white/[.07] bg-white/[.03] px-4 py-2 text-sm text-slate-400">
          <span className="font-semibold text-slate-100">{tasks.length}</span>{" "}
          task komunitas
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[.09] to-blue-500/[.04] p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <div className="text-2xl font-semibold">{tasks.length}</div>
            <div className="text-xs text-slate-400">Jumlah semua pekerjaan</div>
          </div>
        </div>
        {counts.map((item) => {
          const Icon =
            item.value === "selesai"
              ? CheckCircle2
              : item.value === "dikerjakan"
                ? Clock3
                : Circle;
          return (
            <div
              key={item.value}
              className="flex items-center gap-4 rounded-2xl border border-white/[.07] bg-[#0c1526] p-4"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-white/[.04] text-cyan-200">
                <Icon className="size-5" />
              </span>
              <div>
                <div className="text-2xl font-semibold">{item.count}</div>
                <div className="text-xs text-slate-500">{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-white/[.08] bg-[#0c1526] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
            <Plus className="size-4" />
          </span>
          <h2 className="font-semibold">Tambah pekerjaan</h2>
        </div>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
          <input
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Item yang dikerjakan"
            className="h-11 rounded-xl border border-white/10 bg-[#080e1c] px-4 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
          />
          <input
            required
            maxLength={160}
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Nama proyek"
            className="h-11 rounded-xl border border-white/10 bg-[#080e1c] px-4 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
          />
          <select
            value={newStatus}
            onChange={(event) => setNewStatus(event.target.value as TaskStatus)}
            className="h-11 rounded-xl border border-white/10 bg-[#080e1c] px-4 text-sm text-slate-200 outline-none focus:border-cyan-300/50"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            value={position}
            onChange={(event) => setPosition(event.target.value as TaskPosition)}
            aria-label="Posisi pekerjaan"
            className="h-11 rounded-xl border border-white/10 bg-[#080e1c] px-4 text-sm text-slate-200 outline-none focus:border-cyan-300/50"
          >
            {positions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Keterangan atau catatan (opsional)"
            rows={2}
            className="resize-y rounded-xl border border-white/10 bg-[#080e1c] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50 md:col-span-2"
          />
          <textarea
            value={revisionNotes}
            onChange={(event) => setRevisionNotes(event.target.value)}
            placeholder="Keterangan revisi (opsional)"
            rows={2}
            className="resize-y rounded-xl border border-white/10 bg-[#080e1c] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
          />
          <label className="flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#080e1c] px-4 text-xs text-slate-500">
            Tanggal
            <input
              type="date"
              value={revisionDate}
              onChange={(event) => setRevisionDate(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-white/10 bg-[#080e1c] px-4 py-3 md:col-span-2">
            <span className="text-xs text-slate-500">Kategori pekerjaan</span>
            <TaskKindCheckbox
              checked={isNew}
              onChange={setIsNew}
              label="Baru"
            />
            <TaskKindCheckbox
              checked={needsRevision}
              onChange={setNeedsRevision}
              label="Revisi"
            />
          </div>
          <button
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 md:col-span-2 md:justify-self-end"
          >
            <Plus className="size-4" /> Tambahkan task
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari pekerjaan..."
              className="h-11 w-full rounded-xl border border-white/[.08] bg-[#0c1526] pl-10 pr-4 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
            />
          </div>
          <label className="relative">
            <ListFilter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-white/[.08] bg-[#0c1526] pl-10 pr-10 text-sm text-slate-300 outline-none sm:w-52"
            >
              <option value="semua">Semua status</option>
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {visibleTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0c1526]/60 px-5 py-14 text-center">
            <CheckSquare2 className="mx-auto size-8 text-slate-600" />
            <h2 className="mt-4 font-medium text-slate-200">
              {tasks.length ? "Task tidak ditemukan" : "Belum ada pekerjaan"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {tasks.length
                ? "Coba ubah kata kunci atau filter status."
                : "Tambahkan pekerjaan pertamamu menggunakan form di atas."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleTasks.map((task) => {
              const editing = editingId === task.id;
              const canManage = task.user_id === currentUserId;
              return (
                <article
                  key={task.id}
                  className="rounded-2xl border border-white/[.07] bg-[#0c1526] p-3.5 sm:p-4"
                >
                  {editing ? (
                    <div className="space-y-3">
                      <input
                        value={editProjectName}
                        maxLength={160}
                        onChange={(event) => setEditProjectName(event.target.value)}
                        placeholder="Nama proyek"
                        className="h-10 w-full rounded-lg border border-white/10 bg-[#080e1c] px-3 text-sm outline-none focus:border-cyan-300/50"
                      />
                      <input
                        value={editTitle}
                        maxLength={160}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-[#080e1c] px-3 text-sm outline-none focus:border-cyan-300/50"
                      />
                      <select
                        value={editPosition}
                        onChange={(event) =>
                          setEditPosition(event.target.value as TaskPosition)
                        }
                        aria-label="Posisi pekerjaan"
                        className="h-10 w-full rounded-lg border border-white/10 bg-[#080e1c] px-3 text-sm text-slate-200 outline-none focus:border-cyan-300/50"
                      >
                        {positions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-white/10 bg-[#080e1c] px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <textarea
                          value={editRevisionNotes}
                          onChange={(event) => setEditRevisionNotes(event.target.value)}
                          placeholder="Keterangan revisi"
                          rows={2}
                          className="w-full rounded-lg border border-white/10 bg-[#080e1c] px-3 py-2 text-sm outline-none focus:border-cyan-300/50"
                        />
                        <label className="flex h-10 items-center gap-3 rounded-lg border border-white/10 bg-[#080e1c] px-3 text-xs text-slate-500">
                          Tanggal
                          <input
                            type="date"
                            value={editRevisionDate}
                            onChange={(event) => setEditRevisionDate(event.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-white/10 bg-[#080e1c] px-3 py-3">
                        <span className="text-xs text-slate-500">Kategori pekerjaan</span>
                        <TaskKindCheckbox
                          checked={editIsNew}
                          onChange={setEditIsNew}
                          label="Baru"
                        />
                        <TaskKindCheckbox
                          checked={editNeedsRevision}
                          onChange={setEditNeedsRevision}
                          label="Revisi"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <StatusSelect
                          value={editStatus}
                          onChange={setEditStatus}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(task)}
                            disabled={isPending}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cyan-400 px-3 text-xs font-semibold text-slate-950"
                          >
                            <Check className="size-3.5" /> Simpan
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-slate-300"
                          >
                            <X className="size-3.5" /> Batal
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-cyan-200/70">
                          {task.project_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-[15px] font-medium leading-5 text-slate-100">
                            {task.title}
                          </h3>
                          <TaskKindBadge
                            label={
                              positions.find((item) => item.value === task.position)
                                ?.label ?? "Drafter"
                            }
                          />
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyles[task.status]}`}>
                            {statuses.find((status) => status.value === task.status)?.label}
                          </span>
                          {task.is_new && <TaskKindBadge label="Baru" />}
                          {task.needs_revision && <TaskKindBadge label="Revisi" />}
                        </div>
                        {task.description && (
                          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-5 text-slate-400">
                            {task.description}
                          </p>
                        )}
                        {task.completed_at && (
                          <p className="mt-1.5 text-[11px] text-emerald-300/80">
                            Selesai {formatDate(task.completed_at)}
                          </p>
                        )}
                        {task.revision_notes && (
                          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-amber-100/75">
                            Keterangan revisi: {task.revision_notes}
                          </p>
                        )}
                        {task.revision_date && (
                          <p className="mt-1.5 text-[11px] text-amber-200/70">
                            {formatDate(task.revision_date)}
                          </p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span>Dibuat dan dikerjakan oleh</span>
                          {task.creator_profile && (
                            <MemberProfilePopover
                              profile={task.creator_profile}
                              viewerId={currentUserId}
                            >
                              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.08] px-2 py-1 font-medium text-cyan-100">
                                {task.creator_name ?? "Anda"}
                              </span>
                            </MemberProfilePopover>
                          )}
                          <span>
                            · Tanggal dibuat{" "}
                            {new Intl.DateTimeFormat("id-ID", {
                              dateStyle: "medium",
                            }).format(new Date(task.created_at))}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManage && (
                          <>
                            <StatusSelect
                              value={task.status}
                              onChange={(status) => changeStatus(task, status)}
                            />
                            <button
                              onClick={() => beginEdit(task)}
                              aria-label="Edit task"
                              className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:border-cyan-300/30 hover:text-cyan-200"
                            >
                              <Pencil className="size-4" />
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => removeTask(task.id)}
                            aria-label="Hapus task"
                            className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:border-red-300/30 hover:text-red-300"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function TaskKindCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-cyan-400"
      />
      {label}
    </label>
  );
}

function TaskKindBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-medium text-amber-100">
      {label}
    </span>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: TaskStatus;
  onChange: (value: TaskStatus) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as TaskStatus)}
      aria-label="Status pekerjaan"
      className="h-9 max-w-40 rounded-lg border border-white/10 bg-[#080e1c] px-2 text-xs text-slate-300 outline-none focus:border-cyan-300/50"
    >
      {statuses.map((status) => (
        <option key={status.value} value={status.value}>
          {status.label}
        </option>
      ))}
    </select>
  );
}
