import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Keypair, Transaction } from "@solana/web3.js";
import type { WalletLike } from "@/lib/findback/program";

export function loadServerKeypair(): Keypair {
  const inline = process.env.SOLANA_KEYPAIR_JSON?.trim();
  if (inline) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(inline) as number[]));
  }

  const configuredPath = process.env.SOLANA_KEYPAIR?.trim();
  const keypairPath = configuredPath || path.join(os.homedir(), ".config", "solana", "id.json");
  if (!fs.existsSync(keypairPath)) {
    throw new Error("Server chưa cấu hình SOLANA_KEYPAIR_JSON.");
  }
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function keypairWallet(keypair: Keypair): WalletLike {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction>(transaction: T) => {
      transaction.partialSign(keypair);
      return transaction;
    },
  };
}
