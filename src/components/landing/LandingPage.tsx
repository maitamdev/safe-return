"use client";

import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Sparkle,
  Wallet,
  MagnifyingGlass,
  CheckCircle,
  Lock,
  Brain,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";

/**
 * Public landing — Vietnamese-first, 3-step onboarding, no jargon wall.
 */
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#06080f] text-white">
      {/* ambient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(153,69,255,0.28),transparent),radial-gradient(ellipse_50%_40%_at_90%_20%,rgba(20,241,149,0.12),transparent)]"
      />

      <Hero />
      <HowSimple />
      <WhyTrust />
      <RolesSimple />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-28 md:px-8 md:pb-24 md:pt-36">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-white/70">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#14F195]" />
        AI × Solana · Devnet demo · 0 đồng thật
      </div>

      <h1 className="mt-6 max-w-3xl text-[clamp(2.4rem,6vw,4.25rem)] font-semibold leading-[1.05] tracking-tight">
        Mất đồ.{" "}
        <span className="bg-gradient-to-r from-[#c4b5fd] via-[#14F195] to-[#9945FF] bg-clip-text text-transparent">
          AI kiểm chứng.
        </span>
        <br />
        Thưởng trao minh bạch.
      </h1>

      <p className="mt-5 max-w-xl text-base leading-relaxed text-white/55 md:text-lg">
        FindBack AI giúp đăng tin thất lạc, khóa thưởng trên Solana, và để AI
        chấm điểm người tìm thấy — bạn vẫn là người bấm chấp nhận cuối cùng.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Link
          href="/signup"
          className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:bg-white/90"
        >
          Bắt đầu miễn phí
          <ArrowRight
            size={16}
            weight="bold"
            className="transition group-hover:translate-x-0.5"
          />
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          Đã có tài khoản
        </Link>
        <Link
          href="/bounties"
          className="text-sm font-medium text-white/45 underline-offset-4 hover:text-white/80 hover:underline"
        >
          Xem danh sách bounty →
        </Link>
      </div>

      {/* trust row */}
      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/40">
        {[
          "Không cần hiểu blockchain",
          "Phantom chỉ để ký giao dịch",
          "Token FIND = test, không phải tiền thật",
        ].map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <CheckCircle size={14} className="text-[#14F195]" weight="fill" />
            {t}
          </span>
        ))}
      </div>

      {/* live product preview strip */}
      <div className="mt-14 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[0_40px_80px_-40px_rgba(153,69,255,0.45)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="ml-3 font-mono text-[10px] text-white/35">
            findback · bounties · devnet
          </span>
        </div>
        <div className="grid gap-0 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Đăng tin + khóa thưởng",
              desc: "Mô tả đồ, ảnh, số FIND. Ví ký 1 lần — tiền nằm trong escrow.",
              icon: Lock,
              tone: "from-[#9945FF]/30",
            },
            {
              n: "02",
              title: "Người tìm gửi bằng chứng",
              desc: "Ảnh + mô tả. AI so khớp màu, loại đồ, dấu hiệu gian lận.",
              icon: Brain,
              tone: "from-[#14F195]/20",
            },
            {
              n: "03",
              title: "Bạn duyệt → thưởng chuyển",
              desc: "AI chỉ gợi ý. Bạn Accept trên chain — Explorer có chữ ký tx.",
              icon: CurrencyCircleDollar,
              tone: "from-white/10",
            },
          ].map((card) => (
            <div
              key={card.n}
              className={`relative border-white/10 p-6 md:border-r md:last:border-r-0 bg-gradient-to-br ${card.tone} to-transparent`}
            >
              <card.icon size={22} className="text-[#14F195]" weight="duotone" />
              <p className="mt-4 font-mono text-[11px] font-bold text-[#9945FF]">
                {card.n}
              </p>
              <h3 className="mt-1 text-base font-bold">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowSimple() {
  const steps = [
    {
      icon: Wallet,
      title: "Tạo tài khoản",
      body: "Email + mật khẩu. 30 giây. Không cần crypto knowledge.",
      cta: { href: "/signup", label: "Đăng ký" },
    },
    {
      icon: Sparkle,
      title: "Kết nối Phantom (Devnet)",
      body: "Bật Devnet trong Phantom. Nhận FIND test + SOL gas miễn phí trong app.",
      cta: { href: "/bounties", label: "Vào app" },
    },
    {
      icon: MagnifyingGlass,
      title: "Tạo bounty hoặc claim",
      body: "Mất đồ → khóa thưởng. Tìm thấy → gửi claim. AI chấm điểm ngay.",
      cta: { href: "/bounties/create", label: "Tạo bounty" },
    },
  ];

  return (
    <section id="how" className="relative border-t border-white/10 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#14F195]">
          3 bước là xong
        </p>
        <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight md:text-4xl">
          Ai cũng dùng được — không cần biết blockchain
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="group relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-[#14F195]/35 hover:bg-white/[0.05]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#14F195]">
                <s.icon size={22} weight="duotone" />
              </div>
              <p className="mt-5 font-mono text-[11px] text-white/30">
                Bước {i + 1}
              </p>
              <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/50">
                {s.body}
              </p>
              <Link
                href={s.cta.href}
                className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#14F195] group-hover:underline"
              >
                {s.cta.label} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyTrust() {
  const items = [
    {
      icon: Brain,
      title: "AI phân tích claim",
      body: "So khớp mô tả, ảnh, phát hiện mâu thuẫn. Điểm 0–100 + giải thích rõ ràng.",
    },
    {
      icon: Lock,
      title: "Escrow Solana",
      body: "Thưởng khóa trong smart contract. Không ai tự ý rút — kể cả admin app.",
    },
    {
      icon: ShieldCheck,
      title: "Bạn quyết định cuối",
      body: "AI chỉ gợi ý ACCEPT / REVIEW / REJECT. Owner hoặc arbiter mới giải ngân.",
    },
  ];

  return (
    <section id="why" className="relative border-t border-white/10 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid items-end gap-8 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9945FF]">
              Vì sao tin được
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              AI thông minh.
              <br />
              <span className="text-white/45">Web3 minh bạch.</span>
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-white/50 md:text-base">
            Nền tảng tìm đồ cũ dựa vào lời hứa. FindBack khóa thưởng on-chain và
            để AI soi bằng chứng — mỗi bước quan trọng có transaction trên{" "}
            <span className="text-white/80">Solana Explorer (Devnet)</span>.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-3xl border border-white/10 bg-black/30 p-6"
            >
              <it.icon size={28} className="text-[#c4b5fd]" weight="duotone" />
              <h3 className="mt-4 text-base font-bold">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RolesSimple() {
  return (
    <section className="relative border-t border-white/10 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
          Bạn là ai?
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Chọn vai · 1 cú bấm
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            href="/signup?role=owner"
            className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#9945FF]/25 to-transparent p-8 transition hover:border-[#9945FF]/50"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#c4b5fd]">
              Chủ đồ
            </p>
            <h3 className="mt-2 text-2xl font-bold">Tôi mất đồ</h3>
            <p className="mt-3 max-w-sm text-sm text-white/55">
              Đăng tin, khóa FIND làm thưởng, xem AI chấm claim, Accept để trả
              người tìm.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white">
              Tạo tài khoản chủ đồ{" "}
              <ArrowRight
                size={16}
                className="transition group-hover:translate-x-1"
              />
            </span>
          </Link>
          <Link
            href="/signup?role=finder"
            className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#14F195]/15 to-transparent p-8 transition hover:border-[#14F195]/40"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#14F195]">
              Người tìm
            </p>
            <h3 className="mt-2 text-2xl font-bold">Tôi nhặt được đồ</h3>
            <p className="mt-3 max-w-sm text-sm text-white/55">
              Duyệt bounty, gửi ảnh + mô tả. AI chấm điểm. Khi owner Accept, nhận
              FIND vào ví.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white">
              Tạo tài khoản người tìm{" "}
              <ArrowRight
                size={16}
                className="transition group-hover:translate-x-1"
              />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="relative border-t border-white/10 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-r from-[#9945FF]/30 via-[#0b1224] to-[#14F195]/20 px-8 py-12 text-center md:px-16 md:py-16">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Sẵn sàng thử trong 2 phút?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/55">
            Đăng ký → nối Phantom Devnet → nhận FIND test → tạo bounty thật trên
            Explorer.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black hover:bg-white/90"
            >
              Đăng ký ngay <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              href="/login"
              className="inline-flex rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold hover:bg-white/5"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 md:flex-row md:items-center md:px-8">
        <div>
          <p className="font-bold">FindBack AI</p>
          <p className="mt-1 text-xs text-white/40">
            AI verify claims · Solana escrow rewards · Hackathon MVP Devnet
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-white/45">
          <Link href="/bounties" className="hover:text-white">
            App
          </Link>
          <Link href="/login" className="hover:text-white">
            Đăng nhập
          </Link>
          <Link href="/setup" className="hover:text-white">
            Setup SQL
          </Link>
          <a
            href="https://explorer.solana.com/?cluster=devnet"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            Solana Explorer
          </a>
        </div>
      </div>
    </footer>
  );
}
