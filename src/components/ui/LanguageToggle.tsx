"use client";

import { cn } from "@/lib/cn";
import { useI18n, type Lang } from "@/lib/i18n";

export function LanguageToggle({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("lang.switch")}
      className={cn(
        "inline-flex items-center rounded-lg border border-line bg-bg p-0.5",
        className
      )}
    >
      {(["vi", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={cn(
            "rounded-md font-semibold uppercase tracking-wide transition-colors",
            size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
            lang === l
              ? "bg-white text-ink shadow-sm"
              : "text-ink-muted hover:text-ink"
          )}
        >
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
