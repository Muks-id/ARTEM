"use client";

import { useMemo, useState, useTransition } from "react";
import { ClipboardList, Search, Trash2 } from "lucide-react";
import { deleteTask } from "@/app/actions";
import type { Task, TaskStatus } from "@/lib/portal-types";
import type { MemberProfileSummary } from "@/lib/portal-types";
import MemberProfilePopover from "@/components/member-profile-popover";
import MemberTierBadge from "@/components/member-tier-badge";

type AdminTask = Task & {
  ownerName: string;
  ownerEmail: string;
  ownerProfile: MemberProfileSummary;
};

const statuses: { value: TaskStatus; label: string }[] = [
  { value: "belum_dikerjakan", label: "Belum dikerjakan" },
  { value: "dikerjakan", label: "Dikerjakan" },
  { value: "selesai", label: "Selesai" },
];

const statusStyles: Record<TaskStatus, string> = {
  belum_dikerjakan: "border-slate-600/50 bg-slate-500/10 text-slate-300",
  dikerjakan: "border-blue-400/20 bg-blue-400/10 text-blue-200",
  selesai: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
};

export default function AdminTaskManager({
  initialTasks,
  currentUserId,
}: {
  initialTasks: AdminTask[];
  currentUserId: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("semua");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesStatus = filter === "semua" || task.status === filter;
      const matchesSearch =
        !term ||
        [task.project_name, task.title, task.ownerName, task.ownerEmail]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [filter, search, tasks]);

  function removeTask(task: AdminTask) {
    if (!window.confirm(`Hapus task "${task.title}" dari proyek "${task.project_name}"?`)) {
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        await deleteTask(task.id);
        setTasks((current) => current.filter((item) => item.id !== task.id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal menghapus task.");
      }
    });
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-cyan-300">WORKSPACE / ADMIN</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Panel admin
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {tasks.length} task dari seluruh anggota
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/[.08] bg-[#0c1526] px-3 py-2 text-sm text-slate-300">
          <ClipboardList className="size-4 text-cyan-200" />
          {tasks.length} total
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari proyek, pekerjaan, atau anggota"
            className="h-11 w-full rounded-xl border border-white/[.08] bg-[#0c1526] pl-10 pr-4 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
          />
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Filter status"
          className="h-11 rounded-xl border border-white/[.08] bg-[#0c1526] px-4 text-sm text-slate-300 outline-none sm:w-56"
        >
          <option value="semua">Semua status</option>
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {visibleTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0c1526]/60 px-5 py-14 text-center">
          <ClipboardList className="mx-auto size-8 text-slate-600" />
          <h2 className="mt-4 font-medium text-slate-200">Tidak ada task</h2>
          <p className="mt-2 text-sm text-slate-500">
            {tasks.length ? "Coba ubah pencarian atau filter status." : "Task anggota akan muncul di sini."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTasks.map((task) => (
            <article
              key={task.id}
              className="rounded-xl border border-white/[.07] bg-[#0c1526] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/70">
                      {task.project_name}
                    </p>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyles[task.status]}`}
                    >
                      {statuses.find((status) => status.value === task.status)?.label}
                    </span>
                    {task.is_new && (
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                        Baru
                      </span>
                    )}
                    {task.needs_revision && (
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-medium text-amber-100">
                        Revisi
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 font-medium text-slate-100">{task.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Dibuat dan dikerjakan oleh</span>
                    <MemberProfilePopover
                      profile={task.ownerProfile}
                      viewerId={currentUserId}
                    >
                      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-300/[.08] px-2.5 py-1 font-medium text-cyan-100">
                        {task.ownerName}
                        <MemberTierBadge isAdmin={task.ownerProfile.is_admin} />
                      </span>
                    </MemberProfilePopover>
                    <span>· {task.ownerEmail}</span>
                  </div>
                  {task.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                      {task.description}
                    </p>
                  )}
                  {task.completed_at && (
                    <p className="mt-2 text-xs text-emerald-300/80">
                      Selesai {formatDate(task.completed_at)}
                    </p>
                  )}
                  {task.revision_notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-100/75">
                      Revisi: {task.revision_notes}
                    </p>
                  )}
                  {task.revision_date && (
                    <p className="mt-2 text-xs text-amber-200/70">
                      {formatDate(task.revision_date)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeTask(task)}
                  disabled={isPending}
                  aria-label={`Hapus ${task.title}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-300/30 hover:text-red-300 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    date,
  );
}