import { cn } from "@/lib/cn";

export function Badge({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "forest" | "gold" | "dark" | "mint";
}) {
  const tones = {
    default: "bg-black/[0.04] text-ink-soft",
    forest: "bg-forest/10 text-forest-deep",
    gold: "bg-gold-soft text-amber-900",
    dark: "bg-bg-deep text-white",
    mint: "bg-mint text-forest-deep",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
