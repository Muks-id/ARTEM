"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Image from "next/image";
import {
  CheckSquare2,
  MessageCircle,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/portal-types";
import { cn } from "@/lib/utils";
import MemberProfilePopover from "@/components/member-profile-popover";
import {
  createSupabaseBrowserClient,
  setSupabaseBrowserAccessTokenProvider,
} from "@/lib/supabase-browser";

const navigation = [
  { href: "/tasks", label: "Task", icon: CheckSquare2 },
  { href: "/chat", label: "Chat Room", icon: MessageCircle },
  { href: "/messages", label: "Chat Pribadi", icon: Mail },
  { href: "/profile", label: "Profile Saya", icon: UserRound },
];

export default function PortalShell({
  profile,
  isAdmin,
  currentUserId,
  initialUnreadCommunityCount,
  initialUnreadDirectCount,
  children,
}: {
  profile: Profile;
  isAdmin: boolean;
  currentUserId: string;
  initialUnreadCommunityCount: number;
  initialUnreadDirectCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { getToken } = useAuth();
  const [unreadCommunityCount, setUnreadCommunityCount] = useState(
    initialUnreadCommunityCount,
  );
  const [unreadDirectCount, setUnreadDirectCount] = useState(
    initialUnreadDirectCount,
  );
  const visibleNavigation = isAdmin
    ? [...navigation, { href: "/admin", label: "Panel Admin", icon: ShieldCheck }]
    : navigation;

  useEffect(() => {
    setUnreadCommunityCount(initialUnreadCommunityCount);
    setUnreadDirectCount(initialUnreadDirectCount);
  }, [initialUnreadCommunityCount, initialUnreadDirectCount]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<
      ReturnType<typeof createSupabaseBrowserClient>["channel"]
    > | undefined;

    async function subscribeToUnreadMessages() {
      setSupabaseBrowserAccessTokenProvider(getToken);
      const supabase = createSupabaseBrowserClient();
      channel = supabase
        .channel(`portal-unread-messages-${currentUserId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const message = payload.new as { sender_id: string };
            if (message.sender_id === currentUserId || pathname === "/chat") {
              return;
            }
            router.refresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "direct_messages",
            filter: `recipient_id=eq.${currentUserId}`,
          },
          () => router.refresh(),
        )
        .subscribe((status, subscriptionError) => {
          if (
            active &&
            (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          ) {
            console.error(
              "Gagal menghubungkan notifikasi pesan realtime:",
              subscriptionError,
            );
          }
        });
    }

    subscribeToUnreadMessages().catch((cause: unknown) => {
      if (active) {
        console.error("Gagal menyiapkan notifikasi pesan realtime:", cause);
      }
    });

    return () => {
      active = false;
      if (channel) void createSupabaseBrowserClient().removeChannel(channel);
    };
  }, [currentUserId, getToken, pathname, router]);

  return (
    <div className="min-h-screen bg-[#080e1c] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[.07] bg-[#0b1222] px-5 py-6 lg:flex">
        <Brand />
        <p className="mb-3 mt-10 px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">
          Workspace
        </p>
        <nav className="space-y-1">
          {visibleNavigation.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            const unreadCount =
              item.href === "/chat"
                ? unreadCommunityCount
                : item.href === "/messages"
                  ? unreadDirectCount
                  : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                  active
                    ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-inset ring-cyan-300/10"
                    : "text-slate-400 hover:bg-white/[.04] hover:text-slate-100",
                )}
              >
                <Icon className="size-[18px]" />
                {item.label}
                {unreadCount > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold leading-4 text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-blue-300/10 bg-gradient-to-br from-blue-500/10 to-cyan-500/[.03] p-4">
          <div className="mb-2 flex items-center gap-2 text-cyan-200">
            <Sparkles className="size-4" />
            <span className="text-xs font-semibold">Artem Geng</span>
          </div>
          <p className="text-xs leading-5 text-slate-400">
            Ruang kolaborasi untuk terus maju bersama.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-white/[.07] bg-[#080e1c]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-7">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div className="hidden text-sm text-slate-500 lg:block">
              Tempat huru hara{" "}
              <span className="text-slate-300">/ Artem Geng</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <MemberProfilePopover
                  profile={{
                    id: profile.id,
                    full_name: profile.full_name,
                    username: profile.username,
                    avatar_url: profile.avatar_url,
                    bio: profile.bio,
                    is_admin: isAdmin,
                  }}
                  side="bottom"
                  viewerId={profile.id}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
                    {profile.full_name}
                  </span>
                </MemberProfilePopover>
                <div className="text-xs text-slate-500">
                  {profile.username ? `@${profile.username}` : "Anggota Artem Geng"}
                </div>
              </div>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "size-9 ring-2 ring-cyan-300/20",
                  },
                }}
              />
            </div>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-4.5rem)] max-w-7xl px-4 py-8 pb-28 sm:px-7 sm:py-10 sm:pb-28 lg:pb-10">
          {children}
        </main>
      </div>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#080e1c]/95 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-12px_35px_rgba(0,0,0,0.35)] backdrop-blur-2xl lg:hidden"
      >
        <div
          className={`mx-auto grid max-w-md ${
            visibleNavigation.length === 5 ? "grid-cols-5" : "grid-cols-4"
          }`}
        >
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const unreadCount =
              item.href === "/chat"
                ? unreadCommunityCount
                : item.href === "/messages"
                  ? unreadDirectCount
                  : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition",
                  active
                    ? "text-cyan-200"
                    : "text-slate-500 hover:text-slate-200",
                )}
              >
                <Icon
                  className={cn(
                    "size-5",
                    active && "drop-shadow-[0_0_8px_rgba(103,232,249,0.45)]",
                  )}
                />
                {unreadCount > 0 && (
                  <span className="absolute right-[calc(50%-1.25rem)] top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm shadow-red-950/50">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/tasks" className="flex items-center gap-3">
      <Image
        src="/Asset 3.png"
        alt="Logo Artem Geng"
        width={40}
        height={40}
        className="size-10 rounded-xl bg-white object-contain shadow-lg shadow-blue-500/20"
      />
      <span className={cn("font-semibold tracking-tight", compact && "text-sm")}>
        Artem <span className="text-cyan-300">Geng</span>
      </span>
    </Link>
  );
}
