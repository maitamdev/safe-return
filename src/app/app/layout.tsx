"use client";

import dynamic from "next/dynamic";
import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/app/AppShell";
import { WalletBridge } from "@/components/wallet/WalletBridge";

const WalletProviders = dynamic(
  () =>
    import("@/components/wallet/WalletProviders").then((m) => m.WalletProviders),
  { ssr: false, loading: () => <AppLoading /> }
);

function AppLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg text-sm text-ink-muted">
      Loading…
    </div>
  );
}

export default function MvpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProviders>
      <WalletBridge />
      <AppProvider>
        <AppShell>{children}</AppShell>
      </AppProvider>
    </WalletProviders>
  );
}
