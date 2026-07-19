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

const DEFAULT_FIND_MINT = "9F6hBVk5V6HgdcRCsgApoGLU2n68qTYjHKESBoCKRmCy";

function loadDeployer(): Keypair | null {
  try {
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
  } catch {
    return null;
  }
}

function findMintStr() {
  return (
    process.env.NEXT_PUBLIC_FIND_MINT ||
    process.env.NEXT_PUBLIC_MOCK_USDC_MINT ||
    DEFAULT_FIND_MINT
  );
}

async function claimDevnetSol(address: string, amount = 1) {
  try {
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
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : "faucet error",
    };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      address?: string;
      amount?: number;
      usdc?: number;
    };
    const address = body.address?.trim();
    if (!address) {
      return NextResponse.json(
        { ok: false, error: "Thiếu địa chỉ ví. Hãy Connect Phantom trước." },
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

    const mintStr = findMintStr();
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");
    const connection = new Connection(rpc, "confirmed");
    const before = await connection.getBalance(recipient);

    let solClaim: Awaited<ReturnType<typeof claimDevnetSol>> | null = null;
    if (before < 0.05 * 1e9) {
      solClaim = await claimDevnetSol(address, 1);
      if (!solClaim.ok && solClaim.code === "COOLDOWN_ACTIVE") {
        await new Promise((r) => setTimeout(r, 5000));
        solClaim = await claimDevnetSol(address, 1);
      }
    }

    const payer = loadDeployer();
    const uiAmount = Math.min(
      Math.max(Number(body.amount ?? body.usdc) || 100, 1),
      500
    );

    let find:
      | {
          amount: number;
          mint: string;
          ata: string;
          signature: string;
          explorerUrl: string;
        }
      | { skipped: true; note: string; mint: string } = {
      skipped: true,
      note: "Server chưa có key deployer — không mint được FIND. Chạy local hoặc cấu hình SOLANA_KEYPAIR_JSON trên Vercel.",
      mint: mintStr,
    };

    if (payer) {
      const mint = new PublicKey(mintStr);
      const mintInfo = await getMint(connection, mint);
      const atomic = BigInt(Math.round(uiAmount * 10 ** mintInfo.decimals));
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        recipient
      );
      const sig = await mintTo(
        connection,
        payer,
        mint,
        ata.address,
        payer,
        atomic
      );
      find = {
        amount: uiAmount,
        mint: mintStr,
        ata: ata.address.toBase58(),
        signature: sig,
        explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
      };
    }

    await new Promise((r) => setTimeout(r, 800));
    const after = await connection.getBalance(recipient);

    return NextResponse.json({
      ok: true,
      message: payer
        ? `Đã gửi ${uiAmount} FIND (token test) + kiểm tra SOL Devnet. Không phải tiền thật.`
        : "Chỉ thử nạp SOL. FIND cần secret deployer trên server.",
      address,
      sol: {
        before: before / 1e9,
        after: after / 1e9,
        claimed: solClaim?.ok ?? false,
        signature: solClaim?.transactionSignature ?? null,
        explorerUrl: solClaim?.explorerUrl ?? null,
        note:
          before >= 0.05 * 1e9
            ? "Ví đã có đủ SOL test."
            : solClaim?.ok
              ? "Đã claim SOL Devnet miễn phí."
              : solClaim?.message ||
                "Faucet SOL bận — lấy tay tại faucet.solana.com",
      },
      find,
      // backward compat
      usdc: find,
      tips: [
        "Phantom → Settings → Developer → Testnet Mode → Devnet",
        `Import token FIND: ${mintStr}`,
        "Nếu Phantom chặn site → bấm «Vẫn tiếp tục (không an toàn)» (app của bạn)",
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
    info: "POST { address } để nhận SOL Devnet + FIND test token (0đ thật).",
    mint: findMintStr(),
    program:
      process.env.NEXT_PUBLIC_FINDBACK_PROGRAM_ID ||
      "3hLzzJDHvbuKFPKweKEJ3ZAQEijoLLejkvi9ZPmByWna",
  });
}
