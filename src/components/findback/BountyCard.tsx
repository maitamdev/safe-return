"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BountyMeta } from "@/lib/findback/store";
import { FIND_SYMBOL } from "@/lib/findback/config";
import { bountyStatusLabel, bountyStatusTone } from "@/lib/findback/status";
import { Coins, ImageSquare, MapPin, Timer } from "@phosphor-icons/react";

export function statusBadge(status?: string) {
  return bountyStatusTone(status);
}

export function statusLabel(status?: string) {
  return bountyStatusLabel(status);
}

function BountyCardInner({ b, status }: { b: BountyMeta; status?: string }) {
  const deadline = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(b.deadlineUnix * 1000)),
    [b.deadlineUnix],
  );

  return (
    <Link
      href={`/bounties/${b.id}`}
      prefetch={false}
      className="group app-card flex min-h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-forest/45 hover:shadow-[0_18px_50px_rgba(20,65,44,0.11)]"
    >
      {b.imageDataUrl ? (
        <Image
          unoptimized
          src={b.imageDataUrl}
          alt={`Ảnh tham chiếu cho ${b.title}`}
          width={640}
          height={360}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-bg-deep text-ink-muted">
          <div className="text-center">
            <ImageSquare size={30} className="mx-auto" />
            <p className="mt-2 text-xs">Chưa có ảnh tham chiếu</p>
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${statusBadge(status)}`}>
            {statusLabel(status)}
          </span>
          {b.aiReport && (
            <span className="text-xs font-bold text-forest">Điểm {b.aiReport.score}/100</span>
          )}
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug text-ink group-hover:text-forest">{b.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">{b.description}</p>
        <dl className="mt-auto grid gap-2 border-t border-line pt-4 text-xs text-ink-soft">
          <div className="flex items-start gap-2">
            <MapPin size={15} className="mt-0.5 shrink-0 text-forest" />
            <span>{b.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Coins size={15} className="text-forest" />
            <span>
              {b.rewardUi} {FIND_SYMBOL}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Timer size={15} className="text-forest" />
            <span>Hạn {deadline}</span>
          </div>
        </dl>
      </div>
    </Link>
  );
}

export const BountyCard = memo(BountyCardInner);
