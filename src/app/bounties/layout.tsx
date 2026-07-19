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
    <div className="flex min-h-dvh items-center justify-center bg-[#070b14] text-white/60">
      Loading FindBack…
    </div>
  );
}

export default function BountiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#070b14]">
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
