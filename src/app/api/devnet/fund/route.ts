import { PublicKey } from "@solana/web3.js";
import { getMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { FIND_MINT } from "@/lib/findback/config";
import {
  ApiError,
  apiErrorResponse,
  enforceApiRateLimit,
  requireApiUser,
  requireSameOrigin,
} from "@/lib/server/api-security";
import { loadServerKeypair } from "@/lib/server/solana-signer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConnection } from "@/lib/findback/program";
import { withRpcReadRetry } from "@/lib/solana/rpc-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_FIND = 100;

async function claimDevnetSol(address: string) {
  try {
    const response = await fetch("https://j.tools/api/devnet-faucet/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientAddress: address, amount: 1 }),
    });
    const json = (await response.json()) as {
      success?: boolean;
      transactionSignature?: string;
      explorerUrl?: string;
      message?: string;
    };
    return { ok: response.ok && Boolean(json.success), ...json };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Faucet SOL lỗi." };
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireApiUser();
    const admin = createAdminClient();
    await enforceApiRateLimit(
      `devnet-faucet:${user.id}`,
      { limit: 3, windowMs: 60 * 60_000 },
      admin,
    );
    const body = (await req.json()) as { address?: string };
    const recipient = new PublicKey(body.address?.trim() || "");
    const address = recipient.toBase58();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("wallet_pubkey,wallet_verified_at")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile?.wallet_verified_at || profile.wallet_pubkey !== address) {
      throw new ApiError(403, "Chỉ có thể cấp token cho ví đã xác minh của bạn.");
    }

    const connection = getConnection();
    const beforeSol = await withRpcReadRetry(() => connection.getBalance(recipient));
    const solClaim = beforeSol < 0.05 * 1e9 ? await claimDevnetSol(address) : null;

    const payer = loadServerKeypair();
    const mint = new PublicKey(FIND_MINT);
    const mintInfo = await withRpcReadRetry(() => getMint(connection, mint));
    if (!mintInfo.mintAuthority?.equals(payer.publicKey)) {
      throw new ApiError(503, "Máy chủ không giữ mint authority của FIND Devnet.");
    }
    const ata = await withRpcReadRetry(() =>
      getOrCreateAssociatedTokenAccount(connection, payer, mint, recipient),
    );
    const targetAtomic = BigInt(TARGET_FIND) * BigInt(10) ** BigInt(mintInfo.decimals);
    const shortfall = targetAtomic > ata.amount ? targetAtomic - ata.amount : BigInt(0);
    const signature =
      shortfall > BigInt(0)
        ? await mintTo(connection, payer, mint, ata.address, payer, shortfall)
        : null;
    const mintedUi = Number(shortfall) / 10 ** mintInfo.decimals;
    const balanceUi = Number(ata.amount + shortfall) / 10 ** mintInfo.decimals;
    const findNote =
      shortfall > BigInt(0)
        ? `Đã cấp thêm ${mintedUi} FIND Devnet. Số dư hiện tại là ${balanceUi} FIND.`
        : `Ví đã có ${balanceUi} FIND Devnet, không cấp thêm.`;

    const afterSol = await withRpcReadRetry(() => connection.getBalance(recipient));
    return Response.json({
      ok: true,
      message:
        shortfall > BigInt(0)
          ? `Đã bổ sung FIND để ví đạt mức khởi đầu ${TARGET_FIND} FIND Devnet.`
          : findNote,
      address,
      sol: {
        before: beforeSol / 1e9,
        after: afterSol / 1e9,
        claimed: solClaim?.ok ?? false,
        signature: solClaim?.transactionSignature ?? null,
        explorerUrl: solClaim?.explorerUrl ?? null,
        note:
          beforeSol >= 0.05 * 1e9
            ? "Ví đã có đủ SOL để trả phí Devnet."
            : solClaim?.message || "Faucet SOL đang bận; hãy dùng faucet.solana.com.",
      },
      find: {
        amount: mintedUi,
        balance: balanceUi,
        skipped: shortfall === BigInt(0),
        note: findNote,
        mint: FIND_MINT,
        ata: ata.address.toBase58(),
        signature,
        explorerUrl: signature
          ? `https://explorer.solana.com/tx/${signature}?cluster=devnet`
          : null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    info: "Đăng nhập, kết nối và xác minh ví để nhận SOL/FIND thử nghiệm trên Devnet.",
    mint: FIND_MINT,
    targetFind: TARGET_FIND,
  });
}
