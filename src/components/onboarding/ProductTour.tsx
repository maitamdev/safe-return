"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Question } from "@phosphor-icons/react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Bump when tour steps change so returning users see the new tour once. */
export const TOUR_STORAGE_KEY = "safereturn:product-tour:v3";
const LEGACY_KEYS = [
  "safereturn:product-tour:v1",
  "safereturn:product-tour:v2",
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
      title: "Chào mừng bạn đến với SafeReturn",
      description:
        "Nền tảng hỗ trợ tìm lại đồ thất lạc, xác minh bằng chứng và trao thưởng minh bạch trên Solana Devnet. Hãy cùng làm quen với các bước chính trước khi bắt đầu.",
    },
    {
      target: "landing-brand",
      title: "Môi trường thử nghiệm Devnet",
      description:
        "SafeReturn đang vận hành trên Solana Devnet. SOL và FIND tại đây chỉ phục vụ mục đích trải nghiệm — không phải tài sản thật. Vui lòng không chuyển tiền từ mạng chính (mainnet).",
      side: "bottom",
      align: "start",
    },
    {
      target: "landing-how",
      title: "Quy trình hoạt động",
      description:
        "Bốn bước cốt lõi: đăng tin thất lạc, nộp bằng chứng tìm thấy, đối chiếu thông tin, và chủ sở hữu ký xác nhận trả thưởng. Trí tuệ nhân tạo chỉ hỗ trợ đánh giá — không tự động chuyển tiền.",
      side: "top",
      align: "center",
    },
    {
      target: "landing-cta",
      title: "Bắt đầu sử dụng",
      description:
        "Chọn «Xem tin thất lạc» để vào ứng dụng (cần đăng nhập). Sau đó kết nối ví Phantom ở chế độ Devnet để khóa phần thưởng hoặc gửi bằng chứng tìm thấy.",
      side: "bottom",
      align: "start",
    },
    {
      target: "landing-auth",
      title: "Tài khoản và bảo mật",
      description:
        "Đăng ký hoặc đăng nhập bằng email để sử dụng dịch vụ. Ví Phantom dùng để ký giao dịch trên chuỗi khối — không thay thế tài khoản đăng nhập và không được chia sẻ cụm từ khôi phục.",
      side: "bottom",
      align: "end",
    },
    {
      target: "help",
      title: "Hỗ trợ khi cần",
      description:
        "Bạn có thể mở lại hướng dẫn bất cứ lúc nào bằng nút này. Sau khi đăng nhập, hướng dẫn trong ứng dụng sẽ giới thiệu menu chính và thao tác với ví.",
      side: "left",
      align: "end",
    },
  ];
}

/** In-app shell — only when already on /bounties and session is live. */
function appPlan(): PlannedStep[] {
  return [
    {
      title: "Chào mừng bạn đến với SafeReturn",
      description:
        "Bạn đã đăng nhập thành công. Phần hướng dẫn sau sẽ giới thiệu các khu vực quan trọng trong ứng dụng để bạn sử dụng an toàn và hiệu quả.",
    },
    {
      target: "brand",
      title: "SafeReturn trên Solana Devnet",
      description:
        "Mọi giao dịch tại đây diễn ra trên mạng thử nghiệm. Trước khi ký, hãy chắc chắn ví Phantom đang chọn Devnet — SOL và FIND không mang giá trị thương mại.",
      side: "bottom",
      align: "start",
    },
    {
      target: "nav-list",
      title: "Danh sách tin thất lạc",
      description:
        "Xem toàn bộ tin đang mở. Nếu bạn nhặt được đồ, hãy tìm tin phù hợp và gửi bằng chứng riêng tư để chủ sở hữu xem xét.",
      side: "bottom",
      align: "center",
    },
    {
      target: "nav-create",
      title: "Đăng tin khi mất đồ",
      description:
        "Cung cấp mô tả, hình ảnh tham chiếu, khu vực và mức thưởng FIND. Phần thưởng được khóa an toàn cho đến khi bạn chấp nhận bằng chứng hợp lệ.",
      side: "bottom",
      align: "center",
    },
    {
      target: "nav-mine",
      title: "Quản lý tin của bạn",
      description:
        "Theo dõi tin đã đăng và các hồ sơ tìm thấy bạn đã gửi. Tại đây bạn trao đổi, hẹn giao nhận và hoàn tất trả thưởng.",
      side: "bottom",
      align: "center",
    },
    {
      target: "wallet",
      title: "Kết nối ví giao dịch",
      description:
        "Kết nối Phantom (Devnet) để khóa thưởng, ghi nhận bằng chứng trên mạng hoặc nhận FIND. Luôn đọc kỹ nội dung giao dịch trước khi xác nhận — không chia sẻ cụm từ khôi phục ví với bất kỳ ai.",
      side: "bottom",
      align: "end",
    },
    {
      target: "wallet-setup",
      title: "Chuẩn bị tài sản thử nghiệm",
      description:
        "Nếu ví chưa có số dư, hãy bổ sung SOL (phí mạng) và FIND (thưởng demo) qua chức năng chuẩn bị ví hoặc faucet chính thức của Solana.",
      side: "bottom",
      align: "center",
    },
    {
      target: "bounty-list",
      title: "Quy trình trao trả an toàn",
      description:
        "Chủ đồ: đăng tin → xem bằng chứng → hẹn gặp nơi công cộng → nhận đúng đồ → trả thưởng. Người tìm thấy: gửi bằng chứng → trao đổi → giao đồ → nhận thưởng. Nên xác nhận đã nhận đồ trước khi trả thưởng; trả sớm chỉ khi bạn chủ động chấp nhận rủi ro.",
      side: "top",
      align: "center",
    },
    {
      target: "help",
      title: "Bạn đã sẵn sàng",
      description:
        "Chúc bạn sớm tìm lại được đồ thất lạc. Khi cần xem lại hướng dẫn, hãy chọn nút Hướng dẫn ở góc màn hình.",
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
    nextBtnText: "Tiếp tục",
    prevBtnText: "Quay lại",
    doneBtnText: "Bắt đầu sử dụng",
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
