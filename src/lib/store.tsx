"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  cases as seedCases,
  items as seedItems,
  notifications as seedNotifications,
  currentUser,
  type CaseStatus,
  type EscrowStatus,
  type Item,
  type ItemStatus,
  type LostCase,
  type Notification,
} from "@/lib/data";
import {
  fundEscrow as chainFundEscrow,
  getEscrowPdaBase58,
  getEscrowSnapshot,
  initializeCase as chainInitializeCase,
  isChainReady,
  lockForHandover as chainLockHandover,
  programMeta,
  releaseReward as chainReleaseReward,
  seedDemoEscrow,
  setFinder as chainSetFinder,
  toUiEscrowStatus,
} from "@/lib/solana/escrow";
import { PROGRAM_ID, explorerTxUrl, SAFEPOINT_AUTHORITY } from "@/lib/solana/config";
import { getAppWallet } from "@/lib/wallet-bridge";

export type AppRole = "owner" | "finder" | "safepoint";

interface AppState {
  items: Item[];
  cases: LostCase[];
  notifications: Notification[];
  role: AppRole;
  walletConnected: boolean;
  demoStep: number;
  lastTx: string | null;
  lastTxUrl: string | null;
  lastIx: string | null;
  otp: string | null;
  programId: string;
  chainMode: "demo" | "live";
  chainReady: boolean;
  chainError: string | null;
  setRole: (r: AppRole) => void;
  connectWallet: () => void;
  clearChainError: () => void;
  addItem: (item: Omit<Item, "id" | "chainHash" | "registeredAt" | "status">) => Item;
  reportLost: (payload: {
    itemId: string;
    location: string;
    reward: number;
    visibility: string;
  }) => LostCase;
  reportFound: (payload: {
    itemName: string;
    location: string;
    imageGradient: string;
  }) => LostCase;
  fundEscrow: (caseId: string) => Promise<void>;
  acceptMatch: (caseId: string) => Promise<void>;
  startHandover: (caseId: string, safePoint: string) => Promise<string>;
  confirmHandover: (caseId: string, otpInput: string) => Promise<boolean>;
  setDemoStep: (n: number) => void;
  runDemoAdvance: () => void;
  markNotificationsRead: () => void;
  getEscrowPda: (caseId: string) => string | null;
}

const AppContext = createContext<AppState | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function fakeHash() {
  const a = Math.random().toString(36).slice(2, 6);
  const b = Math.random().toString(36).slice(2, 6);
  return `${a}…${b}`;
}

function ensureSeedChain() {
  // Mirror seed cases into the Solana client simulator once per session.
  seedDemoEscrow({
    caseId: "CASE-2026-0142",
    rewardUi: 5,
    owner: currentUser.wallet,
    status: "Unfunded",
    finder: undefined,
  });
  seedDemoEscrow({
    caseId: "CASE-2026-0118",
    rewardUi: 3,
    owner: currentUser.wallet,
    status: "Released",
    finder: "MaiFinder1111111111111111111111111111111",
  });
}

let seeded = false;

export function AppProvider({ children }: { children: ReactNode }) {
  if (!seeded && typeof window !== "undefined") {
    ensureSeedChain();
    seeded = true;
  }

  const [items, setItems] = useState<Item[]>(seedItems);
  const [cases, setCases] = useState<LostCase[]>(seedCases);
  const [notifications, setNotifications] =
    useState<Notification[]>(seedNotifications);
  const [role, setRole] = useState<AppRole>("owner");
  const [walletConnected, setWalletConnected] = useState(true);
  const [demoStep, setDemoStep] = useState(0);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [lastTxUrl, setLastTxUrl] = useState<string | null>(null);
  const [lastIx, setLastIx] = useState<string | null>(null);
  const [otp, setOtp] = useState<string | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);

  const pushNotif = useCallback((title: string, body: string) => {
    setNotifications((prev) => [
      {
        id: uid("n"),
        title,
        body,
        time: "Just now",
        unread: true,
      },
      ...prev,
    ]);
  }, []);

  const recordTx = useCallback(
    (signature: string, instruction: string, explorerUrl?: string) => {
      setLastTx(signature);
      setLastIx(instruction);
      setLastTxUrl(explorerUrl || explorerTxUrl(signature));
      setChainError(null);
    },
    []
  );

  const failChain = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setChainError(msg);
      pushNotif("Solana tx failed", msg.slice(0, 140));
      console.error("[safereturn chain]", err);
    },
    [pushNotif]
  );

  const clearChainError = useCallback(() => setChainError(null), []);

  function finderPubkeyFor(caseRow?: LostCase): string {
    const envFinder = process.env.NEXT_PUBLIC_FINDER_PUBKEY;
    if (envFinder) return envFinder;
    const w = getAppWallet();
    if (role === "finder" && w) return w.publicKey.toBase58();
    if (caseRow?.finderWallet) return caseRow.finderWallet;
    if (w) return w.publicKey.toBase58();
    throw new Error(
      "Chua co finder pubkey. Connect vi (role Finder) hoac set NEXT_PUBLIC_FINDER_PUBKEY"
    );
  }

  const addItem = useCallback(
    (payload: Omit<Item, "id" | "chainHash" | "registeredAt" | "status">) => {
      const item: Item = {
        ...payload,
        id: uid("ITM"),
        status: "ACTIVE",
        registeredAt: new Date().toISOString().slice(0, 10),
        chainHash: fakeHash(),
      };
      setItems((prev) => [item, ...prev]);
      pushNotif("Item registered", `${item.name} · hash ${item.chainHash}`);
      return item;
    },
    [pushNotif]
  );

  const reportLost = useCallback(
    (payload: {
      itemId: string;
      location: string;
      reward: number;
      visibility: string;
    }) => {
      const item = items.find((i) => i.id === payload.itemId);
      const lostCase: LostCase = {
        id: `CASE-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        itemId: payload.itemId,
        itemName: item?.name ?? "Unknown item",
        owner: "Quinn Nguyen",
        location: payload.location,
        lostAt: new Date().toLocaleString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        reward: payload.reward,
        status: "OPEN",
        escrow: "UNFUNDED",
        imageGradient: item?.imageGradient ?? "from-zinc-700 to-zinc-900",
        visibility: payload.visibility,
      };
      setCases((prev) => [lostCase, ...prev]);
      setItems((prev) =>
        prev.map((i) =>
          i.id === payload.itemId
            ? { ...i, status: "LOST" as ItemStatus }
            : i
        )
      );
      const wallet = getAppWallet();
      if (wallet) {
        lostCase.ownerWallet = wallet.publicKey.toBase58();
        void chainInitializeCase({
          caseId: lostCase.id,
          rewardUi: lostCase.reward,
          owner: wallet.publicKey.toBase58(),
          wallet,
          authority: SAFEPOINT_AUTHORITY || wallet.publicKey.toBase58(),
        })
          .then((tx) => {
            recordTx(tx.signature, tx.instruction, tx.explorerUrl);
            pushNotif(
              "On-chain escrow created",
              `${tx.instruction} · ${tx.signature.slice(0, 8)}…`
            );
          })
          .catch(failChain);
      } else {
        pushNotif(
          "Wallet required",
          "Connect Phantom (Devnet) to open on-chain escrow for this case"
        );
      }
      pushNotif("Lost case opened", `${lostCase.id} · ${lostCase.itemName}`);
      return lostCase;
    },
    [items, pushNotif, recordTx, failChain]
  );

  const reportFound = useCallback(
    (payload: {
      itemName: string;
      location: string;
      imageGradient: string;
    }) => {
      const matchCase = cases.find(
        (c) => c.status === "OPEN" || c.status === "MATCH_SUGGESTED"
      );
      if (matchCase) {
        const updated: LostCase = {
          ...matchCase,
          finder: "Mai Tran",
          status: "MATCH_SUGGESTED",
          matchScore: 93,
          matchReasons: [
            "Same black backpack model",
            "Matching white logo",
            "Compatible location",
            "Found shortly after loss report",
          ],
        };
        setCases((prev) =>
          prev.map((c) => (c.id === matchCase.id ? updated : c))
        );
        setItems((prev) =>
          prev.map((i) =>
            i.id === matchCase.itemId
              ? { ...i, status: "FOUND_CANDIDATE" as ItemStatus }
              : i
          )
        );
        pushNotif("AI match found", `93% match for ${matchCase.itemName}`);
        return updated;
      }

      const fresh: LostCase = {
        id: `CASE-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        itemId: "ITM-FOUND",
        itemName: payload.itemName,
        owner: "Unknown",
        finder: "Mai Tran",
        location: payload.location,
        lostAt: new Date().toLocaleString("en-GB"),
        reward: 0,
        status: "CLAIMED",
        escrow: "UNFUNDED",
        matchScore: 72,
        matchReasons: ["Visual similarity pending owner report"],
        imageGradient: payload.imageGradient,
        visibility: "Campus only",
      };
      setCases((prev) => [fresh, ...prev]);
      pushNotif("Found report filed", payload.itemName);
      return fresh;
    },
    [cases, pushNotif]
  );

  const fundEscrow = useCallback(
    async (caseId: string) => {
      const c = cases.find((x) => x.id === caseId);
      if (!c) return;
      const wallet = getAppWallet();
      try {
        if (!getEscrowSnapshot(caseId) || !getEscrowPdaBase58(caseId)) {
          await chainInitializeCase({
            caseId,
            rewardUi: c.reward,
            owner: wallet?.publicKey.toBase58() || currentUser.wallet,
            wallet,
            authority: SAFEPOINT_AUTHORITY || wallet?.publicKey.toBase58(),
          });
        }
        let tx = await chainFundEscrow({
          caseId,
          amountUi: c.reward,
          wallet,
        });
        if (c.finder || c.finderWallet) {
          try {
            const finder = finderPubkeyFor(c);
            tx = await chainSetFinder({ caseId, finder, wallet });
            setCases((prev) =>
              prev.map((row) =>
                row.id === caseId ? { ...row, finderWallet: finder } : row
              )
            );
          } catch (e) {
            console.warn("set_finder after fund", e);
          }
        }
        recordTx(tx.signature, tx.instruction, tx.explorerUrl);
        const snap = getEscrowSnapshot(caseId);
        const escrowUi = snap
          ? (toUiEscrowStatus(snap.status) as EscrowStatus)
          : ("FUNDED" as EscrowStatus);
        setCases((prev) =>
          prev.map((row) =>
            row.id === caseId
              ? {
                  ...row,
                  escrow: escrowUi,
                  status: "MATCH_ACCEPTED" as CaseStatus,
                  ownerWallet: wallet?.publicKey.toBase58() || row.ownerWallet,
                }
              : row
          )
        );
        pushNotif(
          "Escrow funded on Devnet",
          `${tx.instruction} · ${tx.signature.slice(0, 10)}…`
        );
      } catch (e) {
        failChain(e);
        throw e;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cases, pushNotif, recordTx, failChain, role]
  );

  const acceptMatch = useCallback(
    async (caseId: string) => {
      const c = cases.find((x) => x.id === caseId);
      if (!c) return;
      const wallet = getAppWallet();
      try {
        let finder = c.finderWallet;
        if (!finder) {
          finder = finderPubkeyFor(c);
        }
        if (getEscrowSnapshot(caseId) || isChainReady()) {
          try {
            if (!getEscrowSnapshot(caseId)) {
              await chainInitializeCase({
                caseId,
                rewardUi: c.reward,
                owner: c.ownerWallet || wallet?.publicKey.toBase58() || "",
                wallet,
              });
            }
            const tx = await chainSetFinder({ caseId, finder, wallet });
            recordTx(tx.signature, tx.instruction, tx.explorerUrl);
          } catch (e) {
            // Owner must sign set_finder — if role is finder, skip chain until owner funds
            console.warn("set_finder", e);
          }
        }
        setCases((prev) =>
          prev.map((row) =>
            row.id === caseId
              ? {
                  ...row,
                  status: "MATCH_ACCEPTED" as CaseStatus,
                  finderWallet: finder,
                  finder: row.finder || "Mai Tran",
                }
              : row
          )
        );
        pushNotif("Match accepted", `Finder ${finder.slice(0, 8)}…`);
      } catch (e) {
        failChain(e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cases, pushNotif, recordTx, failChain, role]
  );

  const startHandover = useCallback(
    async (caseId: string, safePoint: string) => {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const wallet = getAppWallet();
      try {
        const tx = await chainLockHandover({ caseId, otp: code, wallet });
        recordTx(tx.signature, tx.instruction, tx.explorerUrl);
        setOtp(code);
        setCases((prev) =>
          prev.map((row) =>
            row.id === caseId
              ? {
                  ...row,
                  status: "HANDOVER_PENDING" as CaseStatus,
                  escrow: "LOCKED" as EscrowStatus,
                  safePoint,
                }
              : row
          )
        );
        setItems((prev) => {
          const row = cases.find((x) => x.id === caseId);
          if (!row) return prev;
          return prev.map((i) =>
            i.id === row.itemId
              ? { ...i, status: "RETURN_IN_PROGRESS" as ItemStatus }
              : i
          );
        });
        pushNotif(
          "Handover locked on-chain",
          `OTP hash committed · ${tx.signature.slice(0, 10)}…`
        );
        return code;
      } catch (e) {
        failChain(e);
        throw e;
      }
    },
    [cases, pushNotif, recordTx, failChain]
  );

  const confirmHandover = useCallback(
    async (caseId: string, otpInput: string) => {
      if (otp && otpInput !== otp) return false;
      const c = cases.find((x) => x.id === caseId);
      if (!c) return false;
      const wallet = getAppWallet();
      try {
        const finder = c.finderWallet || finderPubkeyFor(c);
        const owner = c.ownerWallet || wallet?.publicKey.toBase58();
        if (!owner) throw new Error("Missing owner wallet on case");
        const tx = await chainReleaseReward({
          caseId,
          otp: otpInput || otp || "",
          wallet,
          finder,
          owner,
        });
        recordTx(tx.signature, tx.instruction, tx.explorerUrl);
        setCases((prev) =>
          prev.map((row) =>
            row.id === caseId
              ? {
                  ...row,
                  status: "RETURNED" as CaseStatus,
                  escrow: "RELEASED" as EscrowStatus,
                }
              : row
          )
        );
        setItems((prev) => {
          const row = cases.find((x) => x.id === caseId);
          if (!row) return prev;
          return prev.map((i) =>
            i.id === row.itemId ? { ...i, status: "ACTIVE" as ItemStatus } : i
          );
        });
        pushNotif(
          "Reward released on Devnet",
          `release_reward · ${tx.signature.slice(0, 10)}…`
        );
        setOtp(null);
        return true;
      } catch (e) {
        failChain(e);
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cases, otp, pushNotif, recordTx, failChain, role]
  );

  const getEscrowPda = useCallback((caseId: string) => {
    const snap = getEscrowSnapshot(caseId);
    if (snap?.pdaHint) return snap.pdaHint;
    const full = getEscrowPdaBase58(caseId);
    return full ? `${full.slice(0, 4)}…${full.slice(-4)}` : null;
  }, []);

  const runDemoAdvance = useCallback(() => {
    setDemoStep((s) => {
      const next = Math.min(s + 1, 8);
      const main = cases.find((c) => c.id === "CASE-2026-0142") ?? cases[0];
      if (!main) return next;

      if (next === 1) {
        // already open
      } else if (next === 2) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === main.id
              ? {
                  ...c,
                  finder: "Mai Tran",
                  status: "CLAIMED" as CaseStatus,
                }
              : c
          )
        );
      } else if (next === 3) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === main.id
              ? {
                  ...c,
                  status: "MATCH_SUGGESTED" as CaseStatus,
                  matchScore: 93,
                  matchReasons: [
                    "Same black backpack model",
                    "Matching white logo",
                    "Compatible location",
                    "Found 20 minutes after loss report",
                  ],
                }
              : c
          )
        );
        pushNotif("AI match found", "93% match for Black Campus Backpack");
      } else if (next === 4) {
        // secret confirmed — no state change needed
      } else if (next === 5) {
        // Real chain: fund via case page + Phantom (no fake sigs here).
        setCases((prev) =>
          prev.map((c) =>
            c.id === main.id
              ? {
                  ...c,
                  escrow: "FUNDED" as EscrowStatus,
                  status: "MATCH_ACCEPTED" as CaseStatus,
                }
              : c
          )
        );
        pushNotif(
          "Demo step 5",
          "Open case page + Connect Phantom to fund REAL escrow on Devnet"
        );
      } else if (next === 6) {
        const code = "482917";
        setOtp(code);
        setCases((prev) =>
          prev.map((c) =>
            c.id === main.id
              ? {
                  ...c,
                  status: "HANDOVER_PENDING" as CaseStatus,
                  escrow: "LOCKED" as EscrowStatus,
                  safePoint: "Security Office · Gate A",
                }
              : c
          )
        );
        pushNotif(
          "Demo step 6",
          "Use case Start handover with Phantom to lock OTP on-chain"
        );
      } else if (next === 7) {
        // waiting OTP
      } else if (next === 8) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === main.id
              ? {
                  ...c,
                  status: "RETURNED" as CaseStatus,
                  escrow: "RELEASED" as EscrowStatus,
                }
              : c
          )
        );
        setItems((prev) =>
          prev.map((i) =>
            i.id === main.itemId
              ? { ...i, status: "ACTIVE" as ItemStatus }
              : i
          )
        );
        pushNotif(
          "Demo step 8",
          "Confirm OTP on case page to send real release_reward tx"
        );
      }
      return next;
    });
  }, [cases, pushNotif]);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  const value = useMemo(
    () => ({
      items,
      cases,
      notifications,
      role,
      walletConnected,
      demoStep,
      lastTx,
      lastTxUrl,
      lastIx,
      otp,
      programId: PROGRAM_ID,
      chainMode: programMeta.live ? ("live" as const) : ("demo" as const),
      chainReady: isChainReady(),
      chainError,
      setRole,
      connectWallet: () => setWalletConnected(true),
      clearChainError,
      addItem,
      reportLost,
      reportFound,
      fundEscrow,
      acceptMatch,
      startHandover,
      confirmHandover,
      setDemoStep,
      runDemoAdvance,
      markNotificationsRead,
      getEscrowPda,
    }),
    [
      items,
      cases,
      notifications,
      role,
      walletConnected,
      demoStep,
      lastTx,
      lastTxUrl,
      lastIx,
      otp,
      chainError,
      addItem,
      reportLost,
      reportFound,
      fundEscrow,
      acceptMatch,
      startHandover,
      confirmHandover,
      runDemoAdvance,
      markNotificationsRead,
      getEscrowPda,
      clearChainError,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
