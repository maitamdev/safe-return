/**
 * Claim free Devnet SOL for the deployer (or any address) via j.tools faucet.
 * Official public RPC airdrop is often rate-limited.
 *
 * Usage:
 *   node scripts/fund-devnet-sol.mjs
 *   node scripts/fund-devnet-sol.mjs <ADDRESS> [amount]
 */
import { execSync } from "node:child_process";

const addr =
  process.argv[2] ||
  (() => {
    try {
      return execSync("solana address", { encoding: "utf8" }).trim();
    } catch {
      return "DoNrsajZ2Yo8C1biPb8BiB2z3S5ZwZ9VWuFMwF8R2CUa";
    }
  })();
const amount = Number(process.argv[3] || 5);

async function claim(n) {
  const r = await fetch("https://j.tools/api/devnet-faucet/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipientAddress: addr, amount: n }),
  });
  const j = await r.json().catch(async () => ({ raw: await r.text() }));
  return { status: r.status, j };
}

async function balance() {
  const r = await fetch("https://api.devnet.solana.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [addr],
    }),
  });
  const j = await r.json();
  return (j.result?.value ?? 0) / 1e9;
}

console.log("Address:", addr);
console.log("Before :", await balance(), "SOL");

let left = amount;
let attempts = 0;
while (left > 0 && attempts < 6) {
  attempts++;
  const chunk = Math.min(5, left);
  const { status, j } = await claim(chunk);
  console.log(`claim ${chunk} →`, status, j.success ? j.transactionSignature : j);
  if (j.success) {
    left -= chunk;
    console.log("  explorer:", j.explorerUrl);
  } else if (j.code === "COOLDOWN_ACTIVE") {
    const wait = Number(String(j.message || "").match(/(\d+)/)?.[1] || 30);
    console.log(`  cooldown ${wait}s…`);
    await new Promise((r) => setTimeout(r, (wait + 2) * 1000));
  } else {
    console.error("Faucet refused. Try https://faucet.solana.com or Phantom Devnet.");
    break;
  }
}

// small settle
await new Promise((r) => setTimeout(r, 2000));
console.log("After  :", await balance(), "SOL");
