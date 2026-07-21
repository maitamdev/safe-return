"use client";

import dynamic from "next/dynamic";
import { FindBackProvider } from "@/lib/findback/provider";
import { FindBackShell } from "@/components/findback/Shell";
import { WalletBridge } from "@/components/wallet/WalletBridge";
import { AuthGate } from "@/components/auth/AuthGate";

const WalletProviders = dynamic(
  () =>
    import("@/components/wallet/WalletProviders").then((m) => m.WalletProviders),
  { ssr: false, loading: () => <Loading /> }
);

function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4 text-center text-sm text-ink-soft">
      Đang khởi tạo kết nối ví trên mạng thử nghiệm…
    </div>
  );
}

export default function BountiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-bg">
      <AuthGate>
        <WalletProviders>
          <WalletBridge />
          <FindBackProvider>
            <FindBackShell>{children}</FindBackShell>
          </FindBackProvider>
        </WalletProviders>
      </AuthGate>
    </div>
  );
}
