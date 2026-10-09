import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MemberTierBadge({
  isAdmin,
  className,
}: {
  isAdmin: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        isAdmin
          ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
          : "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
        className,
      )}
    >
      {isAdmin && <Crown className="size-3" />}
      {isAdmin ? "Yang Mulia" : "Rakyat Jelata"}
    </span>
  );
}
