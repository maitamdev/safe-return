"use client";

import {
  User,
  HandHeart,
  Buildings,
  GraduationCap,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { useT } from "@/lib/i18n";

export function Roles() {
  const t = useT();
  const roles = [
    { icon: User, title: t("roles.r1t"), body: t("roles.r1d") },
    { icon: HandHeart, title: t("roles.r2t"), body: t("roles.r2d") },
    { icon: Buildings, title: t("roles.r3t"), body: t("roles.r3d") },
    { icon: GraduationCap, title: t("roles.r4t"), body: t("roles.r4d") },
    { icon: ShieldCheck, title: t("roles.r5t"), body: t("roles.r5d") },
  ];

  return (
    <section className="border-y border-line bg-mint-soft/40 py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Reveal>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge>{t("roles.badge2")}</Badge>
              <h2 className="mt-5 max-w-lg font-display text-3xl font-bold tracking-tight md:text-4xl">
                {t("roles.title2")}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
              {t("roles.sub2")}
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.05}>
              <div className="double-bezel h-full">
                <div className="double-bezel-inner flex h-full flex-col p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-white">
                    <r.icon size={20} weight="duotone" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                    {r.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
