"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Question } from "@phosphor-icons/react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

/** Bump when tour steps change so returning users see the new tour once. */
export const TOUR_STORAGE_KEY = "safereturn:product-tour:v1";
const LEGACY_GUIDE_KEYS = [
  "safereturn:first-visit-guide:v1",
  "safereturn:first-visit-guide:v2",
] as const;

const TOUR_EVENT = "safereturn:start-tour";

type PlannedStep = {
  route?: string;
  /** data-tour attribute value, or omit for centered intro */
  target?: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "seen");
    for (const key of LEGACY_GUIDE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // private mode / blocked storage
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
  return nodes.find(isVisible) ?? nodes[0] ?? null;
}

function waitForTourTarget(tourId: string, timeoutMs = 4500): Promise<Element | null> {
  return new Promise((resolve) => {
    const hit = pickTourTarget(tourId);
    if (hit && isVisible(hit)) {
      resolve(hit);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const el = pickTourTarget(tourId);
      if (el && isVisible(el)) {
        window.clearInterval(timer);
        resolve(el);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(el && isVisible(el) ? el : null);
      }
    }, 90);
  });
}

function plan(): PlannedStep[] {
  return [
    {
      title: "Chào mừng đến SafeReturn",
      description:
        "Tìm đồ thất lạc minh bạch trên Solana Devnet. Tour ngắn ~1 phút — chỉ các nút bạn thật sự cần dùng.",
    },
    {
      route: "/bounties",
      target: "brand",
      title: "SafeReturn · mạng thử nghiệm",
      description:
        "Đang chạy Solana Devnet. SOL và FIND chỉ để thử — không phải tiền thật. Đừng gửi tài sản mainnet vào đây.",
      side: "bottom",
      align: "start",
    },
    {
      route: "/bounties",
      target: "nav-list",
      title: "Danh sách tin mất đồ",
      description:
        "Xem tin đang mở. Mất đồ → tạo tin. Nhặt được → tìm tin khớp rồi gửi bằng chứng.",
      side: "bottom",
      align: "center",
    },
    {
      route: "/bounties",
      target: "nav-create",
      title: "Đăng tin khi mất đồ",
      description:
        "Mô tả, ảnh, khu vực và mức thưởng FIND. Thưởng bị khóa trong két đến khi bạn chấp nhận bằng chứng đúng.",
      side: "bottom",
      align: "center",
    },
    {
      route: "/bounties",
      target: "nav-mine",
      title: "Tin & claim của bạn",
      description:
        "Theo dõi tin đã đăng và bằng chứng đã gửi. Mọi bước trả thưởng / giao đồ nằm trong này.",
      side: "bottom",
      align: "center",
    },
    {
      route: "/bounties",
      target: "wallet",
      title: "Kết nối ví Phantom",
      description:
        "Bật Devnet trong Phantom rồi kết nối. Ví dùng để khóa thưởng, gửi bằng chứng và nhận FIND — luôn đọc kỹ trước khi ký.",
      side: "bottom",
      align: "end",
    },
    {
      route: "/bounties",
      target: "wallet-setup",
      title: "Chuẩn bị SOL & FIND thử",
      description:
        "Chưa có số dư? Kết nối ví rồi bấm bổ sung tài sản hoặc faucet. Cần SOL trả phí mạng và FIND để khóa thưởng demo.",
      side: "bottom",
      align: "center",
    },
    {
      route: "/bounties",
      target: "bounty-list",
      title: "Luồng thực tế — nhớ 4 ý",
      description:
        "① Chủ đồ: đăng tin → xem bằng chứng → hẹn nơi công cộng → nhận đồ → trả thưởng. ② Người nhặt: gửi bằng chứng → chat/hẹn → giao đồ → nhận FIND. ③ AI chỉ hỗ trợ đối chiếu, không tự chuyển tiền. ④ Trả sớm chỉ khi chủ đồ tick chấp nhận rủi ro.",
      side: "top",
      align: "center",
    },
    {
      route: "/bounties",
      target: "help",
      title: "Xem lại bất cứ lúc nào",
      description:
        "Bấm nút Hướng dẫn này để chạy lại tour. Chúc bạn tìm được đồ — và dùng ví cẩn thận trên Devnet.",
      side: "left",
      align: "end",
    },
  ];
}

async function runDriverTour(options: {
  router: ReturnType<typeof useRouter>;
  pathname: string | null;
  onDone: () => void;
}) {
  const { router, pathname, onDone } = options;
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

  const ensureRoute = async (route?: string) => {
    if (!route) return;
    const here = pathname;
    if (here === route || (here?.startsWith(`${route}/`) && route !== "/")) return;
    // Always land on list for shell chrome (nav targets).
    if (route === "/bounties" && here?.startsWith("/bounties")) return;
    router.push(route);
    await new Promise((r) => window.setTimeout(r, 420));
    await waitForTourTarget("brand", 5000);
  };

  await ensureRoute("/bounties");

  const resolved: DriveStep[] = [];
  for (const step of plan()) {
    if (step.route) await ensureRoute(step.route);

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

    const el = await waitForTourTarget(step.target, 2800);
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
    doneBtnText: "Bắt đầu dùng",
    steps: resolved,
    onDestroyStarted: () => {
      // User closed / finished — mark seen and tear down.
      if (active?.isActive()) {
        active.destroy();
      }
      finish();
    },
  });

  active.drive();
}

export function ProductTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const runningRef = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const startTour = useCallback(async () => {
    if (runningRef.current) return;
    if (typeof window === "undefined") return;
    if (pathnameRef.current?.startsWith("/t/")) return;

    runningRef.current = true;
    try {
      await runDriverTour({
        router,
        pathname: pathnameRef.current,
        onDone: () => {
          runningRef.current = false;
        },
      });
    } catch {
      runningRef.current = false;
      markTourSeen();
    }
  }, [router]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (pathname?.startsWith("/t/")) return;
    if (pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/auth")) {
      return;
    }
    if (hasSeenTour()) return;

    const timer = window.setTimeout(() => {
      void startTour();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [ready, pathname, startTour]);

  useEffect(() => {
    const onStart = () => void startTour();
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, [startTour]);

  if (!ready || pathname?.startsWith("/t/")) return null;

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

/** Dispatch from anywhere to reopen the product tour. */
export function startProductTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOUR_EVENT));
  }
}
