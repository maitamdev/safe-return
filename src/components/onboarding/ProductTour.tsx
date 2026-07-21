"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Question } from "@phosphor-icons/react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Bump when tour steps change so returning users see the new tour once. */
export const TOUR_STORAGE_KEY = "safereturn:product-tour:v2";
const LEGACY_KEYS = [
  "safereturn:product-tour:v1",
  "safereturn:first-visit-guide:v1",
  "safereturn:first-visit-guide:v2",
] as const;

const TOUR_EVENT = "safereturn:start-tour";

type PlannedStep = {
  target?: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "seen");
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // private mode
  }
}

function hasSeenTour() {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

function isVisible(el: Element) {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function pickTourTarget(tourId: string): Element | null {
  const nodes = Array.from(document.querySelectorAll(`[data-tour="${tourId}"]`));
  return nodes.find(isVisible) ?? null;
}

function waitForTourTarget(tourId: string, timeoutMs = 3500): Promise<Element | null> {
  return new Promise((resolve) => {
    const hit = pickTourTarget(tourId);
    if (hit) {
      resolve(hit);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const el = pickTourTarget(tourId);
      if (el) {
        window.clearInterval(timer);
        resolve(el);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 80);
  });
}

/** Public landing — never touches /bounties (auth-gated). */
function landingPlan(): PlannedStep[] {
  return [
    {
      title: "Chào mừng đến SafeReturn",
      description:
        "Tìm đồ thất lạc minh bạch trên Solana Devnet. Tour ngắn trên trang này — không cần đăng nhập trước.",
    },
    {
      target: "landing-brand",
      title: "SafeReturn · mạng thử nghiệm",
      description:
        "App chạy Solana Devnet. SOL/FIND chỉ để thử — không phải tiền thật. Đừng gửi tài sản mainnet.",
      side: "bottom",
      align: "start",
    },
    {
      target: "landing-how",
      title: "Cách hoạt động",
      description:
        "4 bước: đăng tin → nộp bằng chứng → kiểm tra → chủ đồ ký trả thưởng. AI chỉ hỗ trợ, không tự chuyển tiền.",
      side: "top",
      align: "center",
    },
    {
      target: "landing-cta",
      title: "Bắt đầu khi sẵn sàng",
      description:
        "«Xem tin thất lạc» cần đăng nhập email. Tạo tài khoản miễn phí, rồi kết nối Phantom (Devnet) để khóa thưởng hoặc gửi bằng chứng.",
      side: "bottom",
      align: "start",
    },
    {
      target: "landing-auth",
      title: "Đăng nhập / tạo tài khoản",
      description:
        "Dùng email để vào app. Ví Phantom gắn sau — dùng ký giao dịch, không thay thế tài khoản.",
      side: "bottom",
      align: "end",
    },
    {
      target: "help",
      title: "Xem lại hướng dẫn",
      description:
        "Bấm nút này bất cứ lúc nào. Sau khi đăng nhập, tour trong app sẽ chỉ menu Danh sách · Tạo tin · Của tôi và ví.",
      side: "left",
      align: "end",
    },
  ];
}

/** In-app shell — only when already on /bounties and session is live. */
function appPlan(): PlannedStep[] {
  return [
    {
      title: "Tour nhanh trong app",
      description:
        "Bạn đã đăng nhập. Các bước sau chỉ các nút quan trọng — khoảng 45 giây.",
    },
    {
      target: "brand",
      title: "SafeReturn · Devnet",
      description:
        "SOL và FIND ở đây chỉ để thử. Luôn kiểm tra mạng Phantom là Devnet trước khi ký.",
      side: "bottom",
      align: "start",
    },
    {
      target: "nav-list",
      title: "Danh sách tin",
      description: "Xem tin đang mở. Nhặt được đồ → tìm tin khớp → gửi bằng chứng riêng tư.",
      side: "bottom",
      align: "center",
    },
    {
      target: "nav-create",
      title: "Đăng tin mất đồ",
      description:
        "Mô tả, ảnh, khu vực, mức thưởng FIND. Thưởng khóa trong két đến khi bạn chấp nhận bằng chứng đúng.",
      side: "bottom",
      align: "center",
    },
    {
      target: "nav-mine",
      title: "Của tôi",
      description: "Tin đã đăng và claim đã gửi. Theo dõi chat, hẹn giao và trả thưởng tại đây.",
      side: "bottom",
      align: "center",
    },
    {
      target: "wallet",
      title: "Ví Phantom",
      description:
        "Kết nối ví Devnet để khóa thưởng / nhận FIND. Không chia sẻ seed phrase. Đọc kỹ popup ký.",
      side: "bottom",
      align: "end",
    },
    {
      target: "wallet-setup",
      title: "Chuẩn bị SOL & FIND thử",
      description:
        "Chưa có số dư? Bổ sung tài sản hoặc faucet. Cần SOL trả phí mạng và FIND để demo khóa thưởng.",
      side: "bottom",
      align: "center",
    },
    {
      target: "bounty-list",
      title: "Luồng thực tế",
      description:
        "① Chủ đồ: đăng tin → xem bằng chứng → hẹn nơi công cộng → nhận đồ → trả thưởng. ② Người nhặt: gửi bằng chứng → chat → giao đồ → nhận FIND. ③ Trả sớm chỉ khi chủ đồ tick chấp nhận rủi ro.",
      side: "top",
      align: "center",
    },
    {
      target: "help",
      title: "Xong — dùng thử thôi",
      description: "Cần xem lại? Bấm Hướng dẫn. Chúc bạn tìm được đồ an toàn.",
      side: "left",
      align: "end",
    },
  ];
}

function isAuthPath(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/setup")
  );
}

function isPublicTagPath(pathname: string | null) {
  return Boolean(pathname?.startsWith("/t/"));
}

function isAppPath(pathname: string | null) {
  return Boolean(pathname?.startsWith("/bounties"));
}

async function buildSteps(plan: PlannedStep[]): Promise<DriveStep[]> {
  const resolved: DriveStep[] = [];
  for (const step of plan) {
    if (!step.target) {
      resolved.push({
        popover: {
          title: step.title,
          description: step.description,
          align: "center",
        },
      });
      continue;
    }
    const el = await waitForTourTarget(step.target, 2200);
    if (!el) continue;
    resolved.push({
      element: el,
      popover: {
        title: step.title,
        description: step.description,
        side: step.side ?? "bottom",
        align: step.align ?? "center",
      },
    });
  }
  return resolved;
}

async function runDriverTour(plan: PlannedStep[], onDone: () => void) {
  let active: Driver | null = null;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    markTourSeen();
    try {
      active?.destroy();
    } catch {
      // ignore
    }
    active = null;
    onDone();
  };

  const resolved = await buildSteps(plan);
  if (resolved.length === 0) {
    finish();
    return;
  }

  active = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayOpacity: 0.58,
    stagePadding: 12,
    stageRadius: 16,
    popoverOffset: 16,
    smoothScroll: true,
    disableActiveInteraction: true,
    popoverClass: "sr-driver-theme",
    progressText: "{{current}} / {{total}}",
    nextBtnText: "Tiếp",
    prevBtnText: "Lùi",
    doneBtnText: "Đã hiểu",
    steps: resolved,
    onDestroyStarted: () => {
      if (active?.isActive()) active.destroy();
      finish();
    },
  });

  active.drive();
}

export function ProductTour() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const runningRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const userRef = useRef(user);
  pathnameRef.current = pathname;
  userRef.current = user;

  const startTour = useCallback(async () => {
    if (runningRef.current) return;
    if (typeof window === "undefined") return;

    const path = pathnameRef.current;
    if (isPublicTagPath(path) || isAuthPath(path)) return;

    // Never navigate. Stay on current page — avoid AuthGate → /login.
    const onApp = isAppPath(path) && Boolean(userRef.current);
    const plan = onApp ? appPlan() : landingPlan();

    // App plan needs shell chrome; if user somehow not ready, fall back to landing copy only.
    if (onApp && path && !path.startsWith("/bounties")) {
      return;
    }

    runningRef.current = true;
    try {
      await runDriverTour(plan, () => {
        runningRef.current = false;
      });
    } catch {
      runningRef.current = false;
      markTourSeen();
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Auto-start once — only on public home or already-authenticated app.
  useEffect(() => {
    if (!ready || authLoading) return;
    if (isPublicTagPath(pathname) || isAuthPath(pathname)) return;
    if (hasSeenTour()) return;

    // On /bounties without session, middleware/AuthGate handles login — do NOT start tour.
    if (isAppPath(pathname) && !user) return;

    // Prefer landing first-visit; after login on /bounties also ok if not seen.
    const canAuto =
      pathname === "/" ||
      pathname === "" ||
      (isAppPath(pathname) && Boolean(user));

    if (!canAuto) return;

    const timer = window.setTimeout(() => {
      void startTour();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [ready, authLoading, pathname, user, startTour]);

  useEffect(() => {
    const onStart = () => void startTour();
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, [startTour]);

  if (!ready || isPublicTagPath(pathname) || isAuthPath(pathname)) return null;

  return (
    <button
      type="button"
      data-tour="help"
      onClick={() => void startTour()}
      className="fixed bottom-20 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-bg-elevated px-3.5 text-sm font-bold text-forest shadow-[0_14px_40px_rgba(28,58,44,0.16)] transition hover:-translate-y-0.5 hover:border-forest hover:bg-mint-soft active:translate-y-0 sm:bottom-6 sm:right-6 xl:bottom-6"
      aria-label="Mở hướng dẫn SafeReturn"
    >
      <Question size={19} weight="bold" />
      Hướng dẫn
    </button>
  );
}

export function startProductTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOUR_EVENT));
  }
}
