"use client";

import { MessageCircle, UserRound } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MemberProfileSummary } from "@/lib/portal-types";
import Link from "next/link";

export default function MemberProfilePopover({
  profile,
  children,
  side = "top",
  viewerId,
}: {
  profile: MemberProfileSummary;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  viewerId?: string;
}) {
  const initials = profile.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded-sm text-left outline-none transition hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          aria-label={`Lihat profil ${profile.full_name}`}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="member-profile-popover-content w-[min(20rem,calc(100vw-2rem))] border-white/10 bg-[#0d1729]/95 p-0 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-2xl"
      >
        <div className="relative overflow-hidden rounded-md">
          <div className="relative h-24 overflow-hidden bg-[#0c162b]">
            {/* Shared profile thumbnail animation. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/profile-angry-work.gif.gif"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d1729] via-[#0d1729]/25 to-transparent" />
          </div>
          <div className="px-4 pb-4">
            <div className="-mt-9 relative z-10 flex items-end">
              <Avatar
                name={profile.full_name}
                avatar={profile.avatar_url}
                initials={initials}
              />
            </div>
            <div className="mt-3">
              <h3 className="truncate text-base font-semibold">
                {profile.full_name}
              </h3>
            </div>
            <p className="mt-0.5 text-sm text-cyan-200/80">
              {profile.username ? `@${profile.username}` : "Username belum diatur"}
            </p>
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Bio
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-5 text-slate-300">
                {profile.bio?.trim() || "Belum ada bio."}
              </p>
            </div>
            {viewerId !== profile.id && (
              <Link
                href={`/messages/new?to=${encodeURIComponent(profile.id)}`}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                <MessageCircle className="size-4" />
                Chat pribadi
              </Link>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Avatar({
  name,
  avatar,
  initials,
}: {
  name: string;
  avatar: string | null;
  initials: string;
}) {
  return avatar ? (
    // Member avatars are externally hosted profile images.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatar}
      alt={name}
      className="size-16 rounded-2xl border-2 border-[#0d1729] object-cover shadow-lg"
    />
  ) : (
    <span className="flex size-16 items-center justify-center rounded-2xl border-2 border-[#0d1729] bg-gradient-to-br from-sky-400 to-indigo-600 text-lg font-bold text-white shadow-lg">
      {initials || <UserRound className="size-6" />}
    </span>
  );
}
