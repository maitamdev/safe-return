/**
 * SafeReturn authoritative Devnet smoke test.
 *
 * Proves both paths against the deployed program:
 *   v1: create -> fund -> single claim -> AI review -> release
 *   v2: create -> fund -> three independent Claim PDAs -> AI provenance ->
 *       mismatch rejection -> 2-of-3 dispute rejection -> release one claim ->
 *       immutable attestation/reputation -> repeat settlement rejection
 *
 * This spends only a small amount of Devnet SOL and FIND test token.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  unpackAccount,
} from "@solana/spl-token";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...readEnv(path.join(root, ".env.local")), ...process.env };
const idl = JSON.parse(
  fs.readFileSync(path.join(root, "target", "idl", "findback.json"), "utf8"),
);
const rpc = env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
const connection = new Connection(rpc, {
  commitment: "confirmed",
  disableRetryOnRateLimit: false,
  confirmTransactionInitialTimeout: 60_000,
});
const payer = loadKeypair(
  env.SOLANA_WALLET || path.join(os.homedir(), ".config", "solana", "id.json"),
);
const programId = new PublicKey(env.NEXT_PUBLIC_FINDBACK_PROGRAM_ID);
const mint = new PublicKey(env.NEXT_PUBLIC_FIND_MINT);
const arbiterSigner = Keypair.generate();
const arbiter = arbiterSigner.publicKey;
const arbiterB = Keypair.generate();
const arbiterC = Keypair.generate();
const reward = 100_000n; // 0.1 FIND (6 decimals), Devnet-only.
const deadline = Math.floor(Date.now() / 1000) + 86_400;
const BOUNTY_STATUS = Object.freeze({ FUNDED: 1, RELEASED: 5, DISPUTED: 7 });
const CLAIM_STATUS = Object.freeze({ SUBMITTED: 0, REJECTED: 2, SETTLED: 4 });
const runId = Date.now().toString(36).toUpperCase();
const v1Id = `SMK1${runId}`;
const v2Id = `SMK2${runId}`;
const legacyFinder = Keypair.generate();
const finderA = Keypair.generate();
const finderB = Keypair.generate();
const finderC = Keypair.generate();
const signatures = [];

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).trim()];
      }),
  );
}

function loadKeypair(file) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))),
  );
}

function discriminator(name) {
  const instruction = idl.instructions.find((candidate) => candidate.name === name);
  if (!instruction) throw new Error(`IDL thiếu instruction ${name}`);
  return Buffer.from(instruction.discriminator);
}

function encodeString(value) {
  const body = Buffer.from(value, "utf8");
  const output = Buffer.alloc(4 + body.length);
  output.writeUInt32LE(body.length);
  body.copy(output, 4);
  return output;
}

function encodeU64(value) {
  const output = Buffer.alloc(8);
  output.writeBigUInt64LE(BigInt(value));
  return output;
}

function encodeI64(value) {
  const output = Buffer.alloc(8);
  output.writeBigInt64LE(BigInt(value));
  return output;
}

function hash(label) {
  return crypto.createHash("sha256").update(`safereturn-smoke:${runId}:${label}`).digest();
}

function bountyPda(id) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bounty"), Buffer.from(id)],
    programId,
  )[0];
}

function vaultPda(id) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), Buffer.from(id)],
    programId,
  )[0];
}

function claimPda(id, finder) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim_v2"), bountyPda(id).toBuffer(), finder.toBuffer()],
    programId,
  )[0];
}

function reputationPda(wallet) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reputation"), wallet.toBuffer()],
    programId,
  )[0];
}

function attestationPda(id, finder) {
  const bounty = bountyPda(id);
  const claim = claimPda(id, finder);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("return_attestation"), bounty.toBuffer(), claim.toBuffer()],
    programId,
  )[0];
}

function arbitrationPanelPda(id) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("arbitration_panel"), bountyPda(id).toBuffer()],
    programId,
  )[0];
}

function disputeCasePda(id, finder) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dispute_case"), claimPda(id, finder).toBuffer()],
    programId,
  )[0];
}

function arbitrationVotePda(disputeCase, voter) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("arbitration_vote"), disputeCase.toBuffer(), voter.toBuffer()],
    programId,
  )[0];
}

function ix(name, keys, ...data) {
  return new TransactionInstruction({
    programId,
    keys,
    data: Buffer.concat([discriminator(name), ...data]),
  });
}

function uniqueSigners(signers) {
  return [...new Map(signers.map((signer) => [signer.publicKey.toBase58(), signer])).values()];
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function is429(error) {
  return /\b429\b|too many requests|rate.?limit/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

async function readRpc(operation, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!is429(error) || attempt === attempts - 1) throw error;
      await sleep(1_000 * 2 ** attempt + Math.floor(Math.random() * 300));
    }
  }
  throw new Error("RPC Devnet không phản hồi.");
}

async function waitForAccounts(pubkeys, isReady, label, attempts = 10) {
  let accounts = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    accounts = await readRpc(() =>
      connection.getMultipleAccountsInfo(pubkeys, "confirmed"),
    );
    if (isReady(accounts)) return accounts;
    await sleep(700 + attempt * 250);
  }
  throw new Error(`SMOKE ASSERTION FAILED: RPC chưa phản ánh trạng thái ${label}`);
}

async function send(label, instructions, extraSigners = []) {
  const latest = await readRpc(() => connection.getLatestBlockhash("confirmed"));
  const transaction = new Transaction({
    feePayer: payer.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(...instructions);
  transaction.sign(...uniqueSigners([payer, ...extraSigners]));
  const wire = transaction.serialize();
  const signature = await readRpc(
    () =>
      connection.sendRawTransaction(wire, {
        maxRetries: 8,
        preflightCommitment: "confirmed",
        skipPreflight: false,
      }),
    4,
  );
  const confirmation = await readRpc(
    () => connection.confirmTransaction({ signature, ...latest }, "confirmed"),
    4,
  );
  if (confirmation.value.err) {
    throw new Error(`${label} thất bại: ${JSON.stringify(confirmation.value.err)}`);
  }
  signatures.push({ label, signature });
  console.log(`[TX] ${label}: ${signature}`);
  await sleep(900);
  return signature;
}

async function expectProgramFailure(label, instructions, extraSigners = []) {
  const transaction = new Transaction({ feePayer: payer.publicKey }).add(...instructions);
  const signers = uniqueSigners([payer, ...extraSigners]);
  const simulation = await readRpc(() =>
    // web3.js 1.x uses the legacy Transaction overload here; its second
    // argument is a signer array, not SimulateTransactionConfig.
    connection.simulateTransaction(transaction, signers),
  );
  assert(simulation.value.err, `${label} unexpectedly succeeded`);
  console.log(`[NEGATIVE] ${label}: rejected as expected`);
}

function createInstruction(name, id) {
  const bounty = bountyPda(id);
  const vault = vaultPda(id);
  return ix(
    name,
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: arbiter, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    encodeString(id),
    encodeU64(reward),
    encodeI64(deadline),
    hash(`${id}:metadata`),
  );
}

function fundInstruction(id) {
  const bounty = bountyPda(id);
  const vault = vaultPda(id);
  const ownerToken = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const vaultToken = getAssociatedTokenAddressSync(mint, vault, true);
  return ix(
    "fund_bounty",
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bounty, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: ownerToken, isSigner: false, isWritable: true },
      { pubkey: vaultToken, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    encodeU64(reward),
  );
}

function acceptInstruction(name, id, finder, claim = null) {
  const bounty = bountyPda(id);
  const vault = vaultPda(id);
  const vaultToken = getAssociatedTokenAddressSync(mint, vault, true);
  const finderToken = getAssociatedTokenAddressSync(mint, finder, true);
  const keys = [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: finder, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bounty, isSigner: false, isWritable: true },
  ];
  if (claim) keys.push({ pubkey: claim, isSigner: false, isWritable: true });
  keys.push(
    { pubkey: vault, isSigner: false, isWritable: false },
    { pubkey: vaultToken, isSigner: false, isWritable: true },
    { pubkey: finderToken, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  );
  return ix(name, keys);
}

function decodeBounty(data) {
  let offset = 8;
  const readPublicKey = () => {
    const value = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    return value;
  };
  readPublicKey(); // owner
  const finder = readPublicKey();
  readPublicKey(); // arbiter
  readPublicKey(); // mint
  const idLength = data.readUInt32LE(offset);
  offset += 4;
  const id = data.subarray(offset, offset + idLength).toString("utf8");
  offset += idLength;
  const rewardAmount = data.readBigUInt64LE(offset);
  offset += 8;
  const fundedAmount = data.readBigUInt64LE(offset);
  offset += 8;
  offset += 8; // deadline
  const status = data[offset++];
  offset += 32; // metadata hash
  offset += 32; // evidence hash
  offset += 3; // AI score, risk, decision
  offset += 32; // AI explanation hash
  offset += 2; // bounty + vault bumps
  offset += 8; // created_at
  offset += 8; // updated_at
  const protocolVersion = data[offset] ?? 0;
  return { id, rewardAmount, fundedAmount, status, protocolVersion, finder };
}

function decodeClaim(data) {
  return {
    bounty: new PublicKey(data.subarray(8, 40)),
    finder: new PublicKey(data.subarray(40, 72)),
    evidenceHash: data.subarray(72, 104),
    inputHash: data.subarray(104, 136),
    reportHash: data.subarray(136, 168),
    modelHash: data.subarray(168, 200),
    score: data[200],
    risk: data[201],
    decision: data[202],
    status: data[203],
  };
}

function decodeDisputeCase(data) {
  return {
    bounty: new PublicKey(data.subarray(8, 40)),
    claim: new PublicKey(data.subarray(40, 72)),
    panel: new PublicKey(data.subarray(72, 104)),
    releaseVotes: data[104],
    rejectVotes: data[105],
    decision: data[106],
    finalized: data[107] !== 0,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(`SMOKE ASSERTION FAILED: ${message}`);
}

async function tokenAmount(owner) {
  const address = getAssociatedTokenAddressSync(mint, owner, true);
  const info = await readRpc(() => connection.getAccountInfo(address, "confirmed"));
  return info ? unpackAccount(address, info).amount : 0n;
}

console.log("SafeReturn Devnet smoke v1 + v2");
console.log(`Program: ${programId.toBase58()}`);
console.log(`Mint: ${mint.toBase58()}`);
console.log(`Owner: ${payer.publicKey.toBase58()}`);
console.log(`Bounties: ${v1Id}, ${v2Id}\n`);

const [ownerLamports, ownerFind, claimRent, voteRent] = await Promise.all([
  readRpc(() => connection.getBalance(payer.publicKey, "confirmed")),
  tokenAmount(payer.publicKey),
  readRpc(() => connection.getMinimumBalanceForRentExemption(253)),
  readRpc(() => connection.getMinimumBalanceForRentExemption(98)),
]);
assert(ownerLamports > 50_000_000, "authority cần ít nhất 0.05 SOL Devnet");
assert(ownerFind >= reward * 2n, "authority không đủ FIND test token");

await send(
  "fund ephemeral claim accounts",
  [
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: finderA.publicKey,
      lamports: claimRent + 1_000_000,
    }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: finderB.publicKey,
      lamports: claimRent + 1_000_000,
    }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: finderC.publicKey,
      lamports: claimRent + 1_000_000,
    }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: arbiterSigner.publicKey,
      lamports: voteRent + 1_000_000,
    }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: arbiterB.publicKey,
      lamports: voteRent + 1_000_000,
    }),
  ],
);

// Protocol v1 remains functional for the currently deployed Production client.
await send("v1 create", [createInstruction("create_bounty", v1Id)]);
let v1Account = await readRpc(() => connection.getAccountInfo(bountyPda(v1Id), "confirmed"));
assert(v1Account, "v1 bounty account không tồn tại");
assert(decodeBounty(v1Account.data).protocolVersion === 1, "create_bounty phải ghi protocol_version=1");
await send("v1 fund", [fundInstruction(v1Id)]);
await send(
  "v1 submit claim",
  [
    ix(
      "submit_claim",
      [
        { pubkey: legacyFinder.publicKey, isSigner: true, isWritable: false },
        { pubkey: bountyPda(v1Id), isSigner: false, isWritable: true },
      ],
      hash(`${v1Id}:evidence`),
    ),
  ],
  [legacyFinder],
);
await send("v1 AI review", [
  ix(
    "record_ai_review",
    [
      { pubkey: arbiter, isSigner: true, isWritable: false },
      { pubkey: bountyPda(v1Id), isSigner: false, isWritable: true },
    ],
    Buffer.from([91, 0, 0]),
    hash(`${v1Id}:ai-report`),
  ),
], [arbiterSigner]);
await send("v1 release", [
  acceptInstruction("accept_claim", v1Id, legacyFinder.publicKey),
]);
v1Account = await readRpc(() => connection.getAccountInfo(bountyPda(v1Id), "confirmed"));
const v1State = decodeBounty(v1Account.data);
assert(
  v1State.status === BOUNTY_STATUS.RELEASED && v1State.fundedAmount === 0n,
  "v1 escrow phải Released và rỗng",
);
assert(v1State.finder.equals(legacyFinder.publicKey), "v1 finder settlement không khớp");

// Protocol v2 proves independent claims and immutable settlement provenance.
await send("v2 create", [createInstruction("create_bounty_v2", v2Id)]);
let v2Account = await readRpc(() => connection.getAccountInfo(bountyPda(v2Id), "confirmed"));
assert(v2Account, "v2 bounty account không tồn tại");
assert(decodeBounty(v2Account.data).protocolVersion === 2, "create_bounty_v2 phải ghi protocol_version=2");
await send("v2 fund", [fundInstruction(v2Id)]);

const panel = arbitrationPanelPda(v2Id);
await send("v2 configure 2-of-3 panel", [
  ix(
    "configure_arbitration_panel",
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: bountyPda(v2Id), isSigner: false, isWritable: true },
      { pubkey: panel, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    arbiter.toBuffer(),
    arbiterB.publicKey.toBuffer(),
    arbiterC.publicKey.toBuffer(),
    Buffer.from([2]),
  ),
]);

const claimA = claimPda(v2Id, finderA.publicKey);
const claimB = claimPda(v2Id, finderB.publicKey);
const claimC = claimPda(v2Id, finderC.publicKey);
const evidenceA = hash(`${v2Id}:evidence:A`);
const evidenceB = hash(`${v2Id}:evidence:B`);
const evidenceC = hash(`${v2Id}:evidence:C`);
await send(
  "v2 claim A",
  [
    ix(
      "submit_claim_v2",
      [
        { pubkey: finderA.publicKey, isSigner: true, isWritable: true },
        { pubkey: bountyPda(v2Id), isSigner: false, isWritable: false },
        { pubkey: claimA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      evidenceA,
    ),
  ],
  [finderA],
);
await send(
  "v2 claim B",
  [
    ix(
      "submit_claim_v2",
      [
        { pubkey: finderB.publicKey, isSigner: true, isWritable: true },
        { pubkey: bountyPda(v2Id), isSigner: false, isWritable: false },
        { pubkey: claimB, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      evidenceB,
    ),
  ],
  [finderB],
);
await send(
  "v2 claim C",
  [
    ix(
      "submit_claim_v2",
      [
        { pubkey: finderC.publicKey, isSigner: true, isWritable: true },
        { pubkey: bountyPda(v2Id), isSigner: false, isWritable: false },
        { pubkey: claimC, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      evidenceC,
    ),
  ],
  [finderC],
);

await expectProgramFailure("v2 mismatched claim/finder settlement", [
  acceptInstruction("accept_claim_v2", v2Id, finderA.publicKey, claimB),
]);

const inputHash = hash(`${v2Id}:ai-input`);
const reportHash = hash(`${v2Id}:ai-report`);
const modelHash = hash("groq:model:qwen");
await send("v2 AI provenance", [
  ix(
    "record_ai_review_v2",
    [
      { pubkey: arbiter, isSigner: true, isWritable: false },
      { pubkey: bountyPda(v2Id), isSigner: false, isWritable: false },
      { pubkey: claimA, isSigner: false, isWritable: true },
    ],
    Buffer.from([94, 0, 0]),
    inputHash,
    reportHash,
    modelHash,
  ),
], [arbiterSigner]);

const disputeCase = disputeCasePda(v2Id, finderB.publicKey);
await send("v2 open dispute B", [
  ix("open_dispute_v3", [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: bountyPda(v2Id), isSigner: false, isWritable: true },
    { pubkey: claimB, isSigner: false, isWritable: true },
    { pubkey: panel, isSigner: false, isWritable: false },
    { pubkey: disputeCase, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]),
]);
v2Account = (await waitForAccounts(
  [bountyPda(v2Id)],
  ([account]) => Boolean(
    account && decodeBounty(account.data).status === BOUNTY_STATUS.DISPUTED,
  ),
  "bounty Disputed",
))[0];
assert(
  decodeBounty(v2Account.data).status === BOUNTY_STATUS.DISPUTED,
  "dispute phải khóa bounty ở trạng thái Disputed",
);

for (const [label, voter] of [
  ["lead", arbiterSigner],
  ["second", arbiterB],
]) {
  await send(
    `v2 ${label} arbiter rejects B`,
    [
      ix(
        "cast_arbitration_vote",
        [
          { pubkey: voter.publicKey, isSigner: true, isWritable: true },
          { pubkey: panel, isSigner: false, isWritable: false },
          { pubkey: disputeCase, isSigner: false, isWritable: true },
          { pubkey: claimB, isSigner: false, isWritable: false },
          {
            pubkey: arbitrationVotePda(disputeCase, voter.publicKey),
            isSigner: false,
            isWritable: true,
          },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        Buffer.from([0]),
      ),
    ],
    [voter],
  );
}

let disputeAccount = await readRpc(() => connection.getAccountInfo(disputeCase, "confirmed"));
let disputeState = decodeDisputeCase(disputeAccount.data);
assert(
  disputeState.releaseVotes === 0 && disputeState.rejectVotes === 2 && disputeState.decision === 2,
  "panel phải đạt quorum 2/3 cho quyết định từ chối",
);
await send("v2 finalize rejected dispute B", [
  ix("finalize_dispute_reject", [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    { pubkey: bountyPda(v2Id), isSigner: false, isWritable: true },
    { pubkey: claimB, isSigner: false, isWritable: true },
    { pubkey: panel, isSigner: false, isWritable: false },
    { pubkey: disputeCase, isSigner: false, isWritable: true },
  ]),
]);
([v2Account, disputeAccount] = await waitForAccounts(
  [bountyPda(v2Id), disputeCase],
  ([bountyAccount, caseAccount]) => Boolean(
    bountyAccount &&
    caseAccount &&
    decodeBounty(bountyAccount.data).status === BOUNTY_STATUS.FUNDED &&
    decodeDisputeCase(caseAccount.data).finalized,
  ),
  "bounty Funded và dispute finalized",
));
disputeState = decodeDisputeCase(disputeAccount.data);
assert(
  decodeBounty(v2Account.data).status === BOUNTY_STATUS.FUNDED,
  "quorum từ chối phải mở lại escrow Funded",
);
assert(disputeState.finalized, "dispute case phải được finalize bất biến");

const attestation = attestationPda(v2Id, finderA.publicKey);
const ownerReputation = reputationPda(payer.publicKey);
const finderReputation = reputationPda(finderA.publicKey);
const attest = ix("attest_settlement", [
  { pubkey: payer.publicKey, isSigner: true, isWritable: true },
  { pubkey: payer.publicKey, isSigner: false, isWritable: false },
  { pubkey: finderA.publicKey, isSigner: false, isWritable: false },
  { pubkey: bountyPda(v2Id), isSigner: false, isWritable: false },
  { pubkey: claimA, isSigner: false, isWritable: false },
  { pubkey: attestation, isSigner: false, isWritable: true },
  { pubkey: ownerReputation, isSigner: false, isWritable: true },
  { pubkey: finderReputation, isSigner: false, isWritable: true },
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
]);
const finderBefore = await tokenAmount(finderA.publicKey);
await send("v2 release + attestation", [
  acceptInstruction("accept_claim_v2", v2Id, finderA.publicKey, claimA),
  attest,
]);

const finalAccountKeys = [
  bountyPda(v2Id),
  claimA,
  claimB,
  claimC,
  attestation,
  ownerReputation,
  finderReputation,
];
const finalAccounts = await waitForAccounts(
  finalAccountKeys,
  (accounts) => Boolean(
    accounts.every(Boolean) &&
    decodeBounty(accounts[0].data).status === BOUNTY_STATUS.RELEASED &&
    decodeClaim(accounts[1].data).status === CLAIM_STATUS.SETTLED,
  ),
  "settlement Released",
);
assert(finalAccounts.every(Boolean), "thiếu bounty/claim/attestation/reputation account");
const v2State = decodeBounty(finalAccounts[0].data);
const claimAState = decodeClaim(finalAccounts[1].data);
const claimBState = decodeClaim(finalAccounts[2].data);
const claimCState = decodeClaim(finalAccounts[3].data);
const finderAfter = await tokenAmount(finderA.publicKey);
const vaultAfter = await tokenAmount(vaultPda(v2Id));

assert(v2State.protocolVersion === 2, "v2 protocol version bị thay đổi");
assert(
  v2State.status === BOUNTY_STATUS.RELEASED && v2State.fundedAmount === 0n,
  "v2 escrow phải Released và rỗng",
);
assert(v2State.finder.equals(finderA.publicKey), "v2 settlement finder không khớp");
assert(claimAState.status === CLAIM_STATUS.SETTLED, "claim A phải Settled");
assert(claimBState.status === CLAIM_STATUS.REJECTED, "claim B phải Rejected độc lập");
assert(claimCState.status === CLAIM_STATUS.SUBMITTED, "claim C phải còn độc lập sau khi claim A được chọn");
assert(claimAState.evidenceHash.equals(evidenceA), "content hash bằng chứng không khớp");
assert(claimAState.inputHash.equals(inputHash), "AI input provenance không khớp");
assert(claimAState.reportHash.equals(reportHash), "AI report provenance không khớp");
assert(claimAState.modelHash.equals(modelHash), "AI model provenance không khớp");
assert(finderAfter - finderBefore === reward, "finder chưa nhận đúng FIND từ vault");
assert(vaultAfter === 0n, "vault còn dư FIND sau settlement");

await expectProgramFailure("v2 repeat settlement after escrow release", [
  acceptInstruction("accept_claim_v2", v2Id, finderC.publicKey, claimC),
]);

console.log("\nSMOKE OK");
console.log("- v1 backward compatibility: verified");
console.log("- three independent v2 claims: verified");
console.log("- mismatch + repeat settlement rejection: verified");
console.log("- dispute lock + 2-of-3 quorum: verified");
console.log("- escrow release: verified");
console.log("- AI/content hashes: verified");
console.log("- attestation + reputation: verified");
console.log(`- transactions: ${signatures.length}`);
console.log(
  `Explorer: https://explorer.solana.com/address/${bountyPda(v2Id).toBase58()}?cluster=devnet`,
);
