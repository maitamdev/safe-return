import { PublicKey, Transaction } from "@solana/web3.js";
import { explorerTxUrl } from "./config";
import { getConnection, PROGRAM_PK, type WalletLike } from "./program";

export type SponsoredAction = "create_bounty" | "fund_bounty" | "submit_claim_v2";

export async function sendSponsoredTransaction(
  wallet: WalletLike,
  body: {
    action: SponsoredAction;
    bountyId: string;
    rewardUi?: number;
    deadlineUnix?: number;
    metadataHashHex?: string;
    evidenceHashHex?: string;
  }
): Promise<{ signature: string; url: string; claimPda?: string | null }> {
  const response = await fetch("/api/devnet/sponsor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, wallet: wallet.publicKey.toBase58() }),
  });
  const json = (await response.json().catch(() => ({}))) as {
    error?: string;
    requestId?: string;
    transaction?: string;
    sponsor?: string;
    blockhash?: string;
    lastValidBlockHeight?: number;
    claimPda?: string | null;
  };
  if (
    !response.ok ||
    !json.requestId ||
    !json.transaction ||
    !json.sponsor ||
    !json.blockhash ||
    !json.lastValidBlockHeight
  ) {
    throw new Error(json.error || "Máy chủ chưa chuẩn bị được giao dịch tài trợ.");
  }

  const sponsor = new PublicKey(json.sponsor);
  const transaction = Transaction.from(Buffer.from(json.transaction, "base64"));
  const message = transaction.compileMessage();
  if (!transaction.feePayer?.equals(sponsor) || transaction.recentBlockhash !== json.blockhash) {
    throw new Error("Giao dịch tài trợ không khớp biên nhận máy chủ.");
  }
  if (message.header.numRequiredSignatures !== 2 || transaction.instructions.length !== 1) {
    throw new Error("Giao dịch tài trợ có cấu trúc chữ ký không hợp lệ.");
  }
  const instruction = transaction.instructions[0];
  if (!instruction.programId.equals(PROGRAM_PK)) {
    throw new Error("Giao dịch tài trợ chứa program không được phép.");
  }
  const walletIsSigner = instruction.keys.some(
    (key) => key.isSigner && key.pubkey.equals(wallet.publicKey)
  );
  const sponsorIsSigner = instruction.keys.some(
    (key) => key.isSigner && key.pubkey.equals(sponsor)
  );
  const sponsorSignature = transaction.signatures.find((item) => item.publicKey.equals(sponsor));
  if (!walletIsSigner || !sponsorIsSigner || !sponsorSignature?.signature) {
    throw new Error("Giao dịch tài trợ thiếu chữ ký bắt buộc.");
  }

  const signed = await wallet.signTransaction(transaction);
  if (!signed.verifySignatures()) {
    throw new Error("Ví không tạo được chữ ký hợp lệ cho giao dịch tài trợ.");
  }
  const connection = getConnection();
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: json.blockhash,
      lastValidBlockHeight: json.lastValidBlockHeight,
    },
    "confirmed"
  );

  void fetch("/api/devnet/sponsor", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: json.requestId, signature }),
  });
  return { signature, url: explorerTxUrl(signature), claimPda: json.claimPda };
}
