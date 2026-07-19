"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Coins,
  Flask,
  MagnifyingGlass,
  Package,
  Question,
  ShieldCheck,
  Wallet,
  X,
} from "@phosphor-icons/react";

const STORAGE_KEY = "safereturn:first-visit-guide:v1";

const guideSteps = [
  {
    label: "Làm quen",
    icon: ShieldCheck,
    title: "Chào mừng bạn đến SafeReturn",
    description:
      "Nơi đăng tin thất lạc, gửi bằng chứng và trao thưởng bằng giao dịch có thể kiểm tra.",
    note: "SafeReturn chỉ chạy trên Solana Devnet. SOL và FIND ở đây là tài sản thử nghiệm, không có giá trị tiền thật.",
    items: [
      "Không gửi SOL mainnet hoặc tài sản có giá trị vào ứng dụng.",
      "Thông tin nhạy cảm trong bằng chứng không được đưa lên blockchain.",
      "Mọi lệnh trao thưởng đều cần người dùng kiểm tra và ký.",
    ],
  },
  {
    label: "Chuẩn bị",
    icon: Wallet,
    title: "Tạo tài khoản và kết nối ví",
    description:
      "Tài khoản lưu dữ liệu ứng dụng. Ví Phantom dùng để xác nhận các giao dịch Devnet.",
    note: "Bạn chỉ kết nối ví của chính mình. Ví hệ thống của SafeReturn không được chia sẻ cho người dùng.",
    items: [
      "Tạo tài khoản hoặc đăng nhập bằng email.",
      "Cài Phantom, chuyển sang Devnet rồi kết nối với SafeReturn.",
      "Bấm Chuẩn bị ví Devnet để nhận SOL phí mạng và FIND thử nghiệm.",
    ],
  },
  {
    label: "Mất đồ",
    icon: Package,
    title: "Khi bạn làm mất một món đồ",
    description:
      "Đăng mô tả vừa đủ để cộng đồng nhận biết, nhưng giữ lại một đặc điểm bí mật để đối chiếu.",
    note: "Phần thưởng FIND được khóa trong escrow và chỉ giải ngân sau khi bạn chấp nhận bằng chứng.",
    items: [
      "Đăng khu vực, thời gian, ảnh và mức thưởng FIND.",
      "Xem từng yêu cầu nhận đồ cùng báo cáo đối chiếu.",
      "Chỉ chấp nhận khi đặc điểm bí mật và bằng chứng trùng khớp.",
    ],
  },
  {
    label: "Tìm thấy",
    icon: MagnifyingGlass,
    title: "Khi bạn tìm thấy một món đồ",
    description:
      "Tìm tin phù hợp rồi gửi bằng chứng riêng tư. Chủ đồ vẫn là người quyết định cuối cùng.",
    note: "AI chỉ nêu điểm trùng khớp, mâu thuẫn và dấu hiệu rủi ro. AI không thể tự chuyển phần thưởng.",
    items: [
      "Tìm tin theo tên đồ vật, khu vực hoặc danh mục.",
      "Mô tả đặc điểm chỉ người đang giữ món đồ mới biết.",
      "Theo dõi kết quả và kiểm tra giao dịch trên Solana Explorer.",
    ],
  },
] as const;

export function FirstVisitGuide() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => {
      try {
        setOpen(window.localStorage.getItem(STORAGE_KEY) === null);
      } catch {
        setOpen(true);
      }
      setReady(true);
    });

    return () => window.cancelAnimationFrame(hydrationFrame);
  }, []);

  const rememberAndClose = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "seen");
    } catch {
      // The guide still works when storage is blocked by the browser.
    }
    setOpen(false);
  }, []);

  const openGuide = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => titleRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        rememberAndClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, rememberAndClose]);

  if (!ready || pathname?.startsWith("/t/")) return null;

  const step = guideSteps[stepIndex];
  const StepIcon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === guideSteps.length - 1;

  return (
    <>
      {!open && (
        <button
          ref={openerRef}
          type="button"
          onClick={openGuide}
          className="fixed bottom-4 right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 text-sm font-bold text-forest shadow-[0_14px_40px_rgba(28,58,44,0.16)] transition hover:-translate-y-0.5 hover:border-forest hover:bg-mint-soft active:translate-y-0 sm:bottom-6 sm:right-6"
          aria-haspopup="dialog"
        >
          <Question size={19} weight="bold" />
          Hướng dẫn
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#10251d]/60 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) rememberAndClose();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-visit-guide-title"
            aria-describedby="first-visit-guide-description"
            className="grid max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-white/20 bg-white shadow-[0_32px_100px_rgba(9,31,21,0.32)] sm:max-h-[88dvh] sm:grid-cols-[17rem_minmax(0,1fr)] sm:overflow-hidden sm:rounded-2xl"
          >
            <aside className="relative overflow-hidden bg-forest p-5 text-white sm:flex sm:min-h-[36rem] sm:flex-col sm:p-7">
              <div className="flex items-center justify-between sm:block">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12">
                    <ShieldCheck size={23} weight="fill" />
                  </span>
                  <span className="font-bold tracking-[-0.03em]">SafeReturn</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold sm:mt-6">
                  <Flask size={15} weight="duotone" /> Devnet
                </span>
              </div>

              <div className="mt-5 hidden sm:block">
                <p className="text-sm font-semibold text-white/68">Bạn đang xem</p>
                <p className="mt-2 text-xl font-bold leading-snug">{step.label}</p>
              </div>

              <nav aria-label="Các phần hướng dẫn" className="mt-5 grid grid-cols-4 gap-2 sm:mt-auto sm:grid-cols-1">
                {guideSteps.map((item, index) => {
                  const ItemIcon = item.icon;
                  const active = index === stepIndex;
                  const visited = index < stepIndex;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setStepIndex(index)}
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-left text-xs font-semibold transition sm:justify-start sm:px-3 ${
                        active
                          ? "border-white bg-white text-forest"
                          : "border-white/16 bg-white/6 text-white hover:bg-white/12"
                      }`}
                      aria-current={active ? "step" : undefined}
                      aria-label={`${item.label}${visited ? ", đã xem" : ""}`}
                    >
                      {visited ? <CheckCircle size={18} weight="fill" /> : <ItemIcon size={18} weight={active ? "fill" : "duotone"} />}
                      <span className="hidden sm:inline">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="flex min-w-0 flex-col p-5 sm:min-h-[36rem] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-forest">
                  <StepIcon size={25} weight="duotone" />
                </span>
                <button
                  type="button"
                  onClick={rememberAndClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink-soft transition hover:border-line-strong hover:bg-bg-deep hover:text-ink"
                  aria-label="Đóng hướng dẫn"
                >
                  <X size={19} weight="bold" />
                </button>
              </div>

              <div className="mt-6">
                <p className="text-sm font-bold text-forest">
                  {stepIndex + 1} trong {guideSteps.length}
                </p>
                <h2
                  ref={titleRef}
                  id="first-visit-guide-title"
                  tabIndex={-1}
                  className="font-display mt-2 max-w-xl text-2xl font-bold leading-tight tracking-tight text-ink outline-none sm:text-3xl"
                >
                  {step.title}
                </h2>
                <p id="first-visit-guide-description" className="mt-3 max-w-xl text-sm leading-6 text-ink-soft sm:text-base sm:leading-7">
                  {step.description}
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-950">
                <div className="flex items-start gap-3">
                  {stepIndex === 0 ? <Flask size={20} className="mt-0.5 shrink-0 text-amber-700" weight="duotone" /> : <Coins size={20} className="mt-0.5 shrink-0 text-amber-700" weight="duotone" />}
                  <p>{step.note}</p>
                </div>
              </div>

              <ul className="mt-6 grid gap-3" aria-label="Nội dung cần nhớ">
                {step.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
                    <CheckCircle size={19} weight="fill" className="mt-0.5 shrink-0 text-forest" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                  className={`app-button-secondary ${isFirst ? "invisible" : ""}`}
                  tabIndex={isFirst ? -1 : 0}
                  aria-hidden={isFirst}
                >
                  <ArrowLeft size={17} weight="bold" /> Quay lại
                </button>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={rememberAndClose} className="min-h-11 px-3 text-sm font-semibold text-ink-soft hover:text-forest">
                    Bỏ qua
                  </button>
                  {isLast ? (
                    <Link href="/bounties" onClick={rememberAndClose} className="app-button-primary px-5">
                      Xem tin thất lạc <ArrowRight size={17} weight="bold" />
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setStepIndex((current) => Math.min(guideSteps.length - 1, current + 1))} className="app-button-primary px-5">
                      Tiếp tục <ArrowRight size={17} weight="bold" />
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
