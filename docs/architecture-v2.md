# SafeReturn v2 architecture

SafeReturn v2 remains a Solana Devnet application. FIND and Devnet SOL have no
monetary value. Supabase stores private product data; Solana is the authority
for escrow ownership, claim state and settlement.

## Goals

1. Bind the exact evidence bytes and canonical metadata to an on-chain hash.
2. Allow several finders to submit independent claims for one bounty.
3. Keep existing v1 bounty accounts readable while new writes use v2 claims.
4. Make every AI result reproducible and attributable to its inputs/version.
5. Build wallet reputation from settled returns without exposing private data.
6. Reduce Devnet onboarding friction without letting a server sign as a user.

## Trust boundaries

- A wallet signature proves control of a wallet, not the truth of a claim.
- Supabase is allowed to store and serve private encrypted/access-controlled
  metadata, but it cannot change data without failing content verification.
- AI only recommends. It never owns a vault and never releases a reward.
- Settlement requires the bounty owner or an arbitration quorum on-chain.
- A sponsored fee payer may pay SOL fees but never replaces the user signer.

## Backwards-compatible on-chain model

The existing `Bounty` account layout and v1 instructions stay readable. New
claims use a separate PDA so old bounty accounts do not need reallocating.

```text
Bounty PDA      = ["bounty", bounty_id]
ClaimV2 PDA     = ["claim_v2", bounty_pubkey, finder_pubkey]
Reputation PDA  = ["reputation", wallet_pubkey]
Arbitration PDA = ["arbitration", claim_v2_pubkey]
Vote PDA        = ["vote", arbitration_pubkey, arbiter_pubkey]
```

### ClaimV2

- `bounty`: parent bounty public key
- `finder`: claim signer
- `evidence_hash`: canonical evidence commitment
- `ai_report_hash`: canonical AI report commitment
- `ai_input_hash`: exact input bundle reviewed by AI
- `ai_model_hash`: provider/model/prompt version commitment
- `score`, `risk`, `decision`
- `status`: Submitted, AiReviewed, Rejected, Disputed, Selected, Settled
- `created_at`, `updated_at`, `bump`

One wallet can create at most one claim for a bounty. Different wallets can
claim concurrently. Rejecting one claim never resets or deletes other claims.

### Settlement invariants

- A bounty can release its reward at most once.
- Only a fully funded bounty can settle to a finder.
- The selected ClaimV2 must belong to the bounty and destination finder.
- A rejected claim cannot be selected or disputed.
- AI state never authorizes a token transfer.
- Refund transfers the full remaining vault balance after expiry.
- Every mutable PDA is verified with canonical seeds and bump constraints.

## Canonical content commitments

Canonical payloads are versioned JSON objects with stable key ordering. Images
are represented by a SHA-256 digest of decoded bytes, MIME type and byte size;
storage paths and signed URLs are never part of a commitment.

```json
{
  "version": 2,
  "kind": "claim-evidence",
  "bountyId": "...",
  "finder": "...",
  "description": "...",
  "location": "...",
  "foundAt": "...",
  "image": {
    "sha256": "...",
    "mimeType": "image/jpeg",
    "byteSize": 123456
  }
}
```

The owner listing uses the same pattern and includes title, description,
category, location, reward base units, deadline, owner wallet and reference
image descriptor.

## Evidence Vault

- `listing-media` bucket: authenticated readers, owner/server writers.
- `claim-evidence` bucket: only finder, bounty owner and verified arbiters read.
- Objects use random immutable names under a user-scoped prefix.
- Upload API validates MIME signature, size, decoded pixels and SHA-256.
- Database stores object path plus digest, MIME and size.
- Reads use a short-lived signed URL or an authenticated same-origin endpoint.
- Legacy data URLs remain readable during migration but all new writes use v2.

## AI provenance

Each report includes:

- provider and exact model ID
- prompt version
- canonical AI input hash
- owner metadata/image hash
- claim evidence/image hash
- generation timestamp
- normalized report and report hash

Missing finder imagery can never produce `ACCEPT`; this guard is enforced after
the live model response as well as in the prompt.

## Database v2

- `bounties`: add media descriptor columns and `protocol_version`.
- `claims`: add generated UUID, claim PDA, media descriptor, provenance hashes;
  replace the bounty-only primary key with a unique `(bounty_id, finder_wallet)`.
- `reputation_events`: append-only projection of settled on-chain activity.
- `chain_events`: idempotent index keyed by `(signature, event_index)`.
- Realtime remains a presentation optimization, never a settlement authority.

## Delivery order

1. Add canonical v2 hash helpers and compatibility tests.
2. Add private storage schema/policies and upload/read APIs.
3. Add ClaimV2 instructions and client codecs.
4. Migrate claims schema and UI to claim collections.
5. Add AI provenance and ClaimV2 review recording.
6. Add Reputation PDA/attestation and SafeTag QR flows.
7. Add sponsored Devnet fee payer with strict allowlists and rate limits.
8. Add quorum arbitration, integration/security tests and verified build.

## Definition of done

- Changing one image byte makes verification fail.
- At least three wallets can submit claims to the same bounty on Devnet.
- Selecting one claim releases FIND once; every repeat/mismatched attempt fails.
- Private claim media is inaccessible to unrelated authenticated users.
- AI reports expose evidence quality and complete provenance.
- All web, Rust, integration and negative-path tests pass in CI.
- The deployed program has a reproducible/verifiable build reference.
