export async function sha256Bytes(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

export async function requireVerifiedWallet(address: string) {
  const response = await fetch("/api/wallet/status", { cache: "no-store" });
  const json = (await response.json().catch(() => ({}))) as {
    address?: string | null;
    error?: string;
  };
  if (!response.ok || json.address !== address) {
    throw new Error(json.error || "Hãy bấm “Xác minh ví” trước khi thao tác.");
  }
}
