"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "dark" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  className?: string;
  icon?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-forest text-white hover:bg-forest-deep",
  secondary: "bg-white text-ink border border-line-strong hover:bg-bg",
  ghost: "bg-transparent text-ink hover:bg-black/[0.04]",
  dark: "bg-bg-deep text-white hover:bg-black",
  outline: "bg-transparent text-forest border border-forest/25 hover:bg-mint-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
};

export function Button({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className,
  icon = false,
  type = "button",
  disabled,
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center font-medium transition-colors duration-150 active:opacity-90 disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className
  );

  const content = (
    <>
      <span>{children}</span>
      {icon && <ArrowRight size={16} weight="bold" className="opacity-90" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}
