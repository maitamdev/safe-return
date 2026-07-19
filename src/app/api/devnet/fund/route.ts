import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loadDeployer(): Keypair | null {
  // Vercel / CI: set secret SOLANA_KEYPAIR_JSON='[...]' (never commit)
  const inline = process.env.SOLANA_KEYPAIR_JSON?.trim();
  if (inline) {
    const raw = JSON.parse(inline) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const p =
    process.env.SOLANA_KEYPAIR ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function claimDevnetSol(address: string, amount = 2) {
  const r = await fetch("https://j.tools/api/devnet-faucet/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipientAddress: address, amount }),
  });
  const j = (await r.json()) as {
    success?: boolean;
    transactionSignature?: string;
    explorerUrl?: string;
    message?: string;
    code?: string;
  };
  return { ok: r.ok && !!j.success, status: r.status, ...j };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { address?: string; usdc?: number };
    const address = body.address?.trim();
    if (!address) {
      return NextResponse.json(
        { ok: false, error: "Thiếu địa chỉ ví Phantom." },
        { status: 400 }
      );
    }

    let recipient: PublicKey;
    try {
      recipient = new PublicKey(address);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Địa chỉ ví không hợp lệ." },
        { status: 400 }
      );
    }

    const mintStr = process.env.NEXT_PUBLIC_MOCK_USDC_MINT;
    if (!mintStr) {
      return NextResponse.json(
        {
          ok: false,
          error: "Chưa có MOCK_USDC_MINT. Chạy: npm run solana:setup",
        },
        { status: 500 }
      );
    }

    const rpc =
      process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");
    const connection = new Connection(rpc, "confirmed");
    const before = await connection.getBalance(recipient);

    // 1) Free Devnet SOL (test money — not real)
    let solClaim: Awaited<ReturnType<typeof claimDevnetSol>> | null = null;
    if (before < 0.05 * 1e9) {
      solClaim = await claimDevnetSol(address, 2);
      if (!solClaim.ok && solClaim.code === "COOLDOWN_ACTIVE") {
        // retry once after short wait
        await new Promise((r) => setTimeout(r, 32_000));
        solClaim = await claimDevnetSol(address, 2);
      }
    }

    // 2) Mint mock USDC from deployer (optional if keypair available)
    const payer = loadDeployer();
    let usdc:
      | {
          amount: number;
          mint: string;
          ata: string;
          signature: string;
          explorerUrl: string;
          note?: string;
        }
      | { skipped: true; note: string; mint: string } = {
      skipped: true,
      note: "Chưa cấu hình SOLANA_KEYPAIR_JSON trên server — chỉ nạp SOL. Chạy local hoặc set secret trên Vercel để mint mock USDC.",
      mint: mintStr,
    };

    if (payer) {
      const mint = new PublicKey(mintStr);
      const mintInfo = await getMint(connection, mint);
      const uiAmount = Math.min(Math.max(Number(body.usdc) || 100, 1), 1000);
      const atomic = BigInt(Math.round(uiAmount * 10 ** mintInfo.decimals));
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        recipient
      );
      const usdcSig = await mintTo(
        connection,
        payer,
        mint,
        ata.address,
        payer,
        atomic
      );
      usdc = {
        amount: uiAmount,
        mint: mintStr,
        ata: ata.address.toBase58(),
        signature: usdcSig,
        explorerUrl: `https://explorer.solana.com/tx/${usdcSig}?cluster=devnet`,
      };
    }

    await new Promise((r) => setTimeout(r, 1500));
    const after = await connection.getBalance(recipient);

    return NextResponse.json({
      ok: true,
      message: payer
        ? "Đã nạp tiền ảo Devnet (SOL + mock USDC). Không phải tiền thật."
        : "Đã nạp SOL Devnet (tiền ảo). Mock USDC cần secret deployer trên server.",
      address,
      sol: {
        before: before / 1e9,
        after: after / 1e9,
        claimed: solClaim?.ok ?? false,
        signature: solClaim?.transactionSignature ?? null,
        explorerUrl: solClaim?.explorerUrl ?? null,
        note:
          solClaim?.ok === false
            ? solClaim?.message ||
              "SOL đã đủ hoặc faucet tạm nghỉ."
            : before >= 0.05 * 1e9
              ? "Ví đã có đủ SOL test, bỏ qua claim."
              : "Đã claim SOL Devnet miễn phí.",
      },
      usdc,
      tips: [
        "Phantom → Settings → Developer Settings → Testnet Mode → Devnet",
        "Import token mint mock USDC nếu chưa thấy số dư",
        "Mọi giao dịch chỉ trên Devnet — 0 đồng thật",
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "POST { address } để nhận SOL Devnet + mock USDC (tiền ảo, free).",
    mint: process.env.NEXT_PUBLIC_MOCK_USDC_MINT || null,
    program: process.env.NEXT_PUBLIC_SAFERETURN_PROGRAM_ID || null,
  });
}
