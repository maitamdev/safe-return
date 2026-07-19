import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/app/AppShell";
import { WalletProviders } from "@/components/wallet/WalletProviders";
import { WalletBridge } from "@/components/wallet/WalletBridge";

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
