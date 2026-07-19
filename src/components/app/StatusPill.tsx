"use client";

import { statusColor } from "@/lib/data";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const t = useT();
  const label = t(`status.${status}`);
  const text =
    label === `status.${status}`
      ? status.replaceAll("_", " ")
      : label;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
        statusColor(status),
        className
      )}
    >
      {text}
    </span>
  );
}
