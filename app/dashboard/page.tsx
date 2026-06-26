"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import LoginModal, { type CircleSession } from "../components/LoginModal";
import SiteFooter from "../components/SiteFooter";
import type { StreamHistoryStream, StreamHistoryTransaction } from "../../lib/arcDrift";

const SESSION_STORAGE_KEY = "arc-drift-circle-session";
const ARC_EXPLORER = "https://testnet.arcscan.app";

type StreamHistoryResponse = {
  streams?: StreamHistoryStream[];
  activeStream?: StreamHistoryStream | null;
  transactions?: StreamHistoryTransaction[];
  error?: string;
};

type ChallengeResponse = {
  challengeId?: string;
  error?: string;
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession) as CircleSession;

    if (session.userToken && session.encryptionKey && session.walletId && session.address) {
      return session;
    }
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return null;
}

function progressFor(stream: StreamHistoryStream) {
  const now = Math.floor(Date.now() / 1000);

  if (now >= stream.endTime || !stream.active) {
    return 100;
  }

  if (now < stream.startTime) {
    return 0;
  }

  const duration = stream.endTime - stream.startTime;
  if (duration <= 0) {
    return 100;
  }

  if (stream.ruleType === "delayed" || stream.ruleType === "cancelable") {
    return 0;
  }

  if (stream.ruleType === "recurring") {
    const interval = stream.interval || duration;
    const periods = Math.floor((now - stream.startTime) / interval);
    const totalPeriods = Math.ceil(duration / interval);
    return Math.min(100, Math.max(0, (periods / totalPeriods) * 100));
  }

  return Math.min(100, Math.max(0, ((now - stream.startTime) / duration) * 100));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Action failed";
}

function executeCircleChallenge(session: CircleSession, challengeId: string) {
  return new Promise<void>((resolve, reject) => {
    const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

    if (!appId) {
      reject(new Error("NEXT_PUBLIC_CIRCLE_APP_ID is not configured"));
      return;
    }

    const sdk = new W3SSdk();
    sdk.setAppSettings({ appId });
    sdk.setAuthentication({
      userToken: session.userToken,
      encryptionKey: session.encryptionKey,
    });

    sdk.execute(challengeId, (error, result) => {
      if (error) {
        reject(new Error(getErrorMessage(error)));
        return;
      }

      if (!result) {
        reject(new Error("Circle challenge completed without a result"));
        return;
      }

      resolve();
    });
  });
}

export default function DashboardPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [session, setSession] = useState<CircleSession | null>(() => readStoredSession());
  const [streams, setStreams] = useState<StreamHistoryStream[]>([]);
  const [transactions, setTransactions] = useState<StreamHistoryTransaction[]>([]);
  const [status, setStatus] = useState("Connect wallet to load your streams.");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const activeStreams = useMemo(() => streams.filter((stream) => stream.active), [streams]);
  const completedStreams = useMemo(() => streams.filter((stream) => !stream.active), [streams]);
  const totalVolume = useMemo(() => streams.reduce((total, stream) => total + Number(stream.amount || 0), 0), [streams]);

  const refreshHistory = useCallback(async (nextSession = session) => {
    if (!nextSession) {
      return;
    }

    setLoading(true);
    setStatus("Loading contract history");

    try {
      const res = await fetch("/api/stream-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: nextSession.address }),
      });
      const data = await res.json() as StreamHistoryResponse;

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load stream history");
      }

      setStreams(data.streams ?? []);
      setTransactions(data.transactions ?? []);
      setStatus((data.streams?.length ?? 0) > 0 ? "History synced from Arc Testnet" : "No streams found for this wallet yet");
    } catch (error: unknown) {
      setStatus(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshHistory(session);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshHistory, session]);

  async function createActionChallenge(path: string, driftId: string) {
    if (!session) {
      setShowLogin(true);
      return;
    }

    setActionId(driftId);
    setStatus("Preparing Circle challenge");

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken: session.userToken,
          walletId: session.walletId,
          driftId,
        }),
      });
      const data = await res.json() as ChallengeResponse;

      if (!res.ok || !data.challengeId) {
        throw new Error(data.error ?? "Circle did not return a challenge");
      }

      setStatus("Confirm the action in Circle");
      await executeCircleChallenge(session, data.challengeId);
      setStatus("Transaction submitted. Refreshing history.");
      await refreshHistory(session);
    } catch (error: unknown) {
      setStatus(getErrorMessage(error));
    } finally {
      setActionId(null);
    }
  }

  function disconnect() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setStreams([]);
    setTransactions([]);
    setStatus("Wallet disconnected");
  }

  return (
    <main className="min-h-screen bg-[#050505] text-[#EDEDED]">
      <nav className="border-b border-[#EDEDED]/10 bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Arc Drift home">
            <Image src="/arc-drift-logo.svg" alt="" width={32} height={32} priority />
            <span className="text-sm font-semibold uppercase tracking-[0.28em]">Arc Drift</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/docs" className="hidden text-xs uppercase tracking-[0.2em] text-[#AFAFAF] transition hover:text-[#ACC6E9] sm:block">Docs</Link>
            <button
              onClick={() => session ? disconnect() : setShowLogin(true)}
              className="h-10 rounded-lg border border-[#EDEDED]/15 px-4 text-sm text-[#EDEDED] transition hover:border-[#ACC6E9] hover:text-[#ACC6E9]"
            >
              {session ? "Disconnect" : "Sign in"}
            </button>
          </div>
        </div>
      </nav>

      <section className="border-b border-[#EDEDED]/10 px-5 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">Creator and client dashboard</p>
            <h1 className="mt-5 max-w-2xl text-6xl font-medium leading-none">All streams. One wallet view.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#CFCFCF]">
              Track active, completed, cancelled, and recurring Arc Drift payments without changing the existing create-flow.
            </p>
          </div>
          <div className="grid content-start gap-3 rounded-lg border border-[#EDEDED]/12 bg-[#151515] p-4">
            <div className="rounded-lg bg-[#EDEDED] p-5 text-[#050505]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#4A4A4A]">Connected wallet</p>
              <p className="mt-5 break-all font-mono text-sm">{session?.address ?? "Not connected"}</p>
              <p className="mt-5 text-sm leading-6 text-[#292929]">{status}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Active", activeStreams.length.toString()],
                ["Completed", completedStreams.length.toString()],
                ["USDC volume", totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#EDEDED]/10 bg-[#292929] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#AFAFAF]">{label}</p>
                  <p className="mt-3 text-2xl text-[#EDEDED]">{value}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => session ? refreshHistory(session) : setShowLogin(true)}
              disabled={loading}
              className="h-12 rounded-lg bg-[#ACC6E9] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#050505] transition hover:bg-[#EDEDED] disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? "Syncing" : "Refresh history"}
            </button>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6">
          {streams.length === 0 ? (
            <div className="rounded-lg border border-[#EDEDED]/10 bg-[#151515] p-8 text-[#AFAFAF]">
              No streams to show yet. Create a stream from the main app, then return here.
            </div>
          ) : (
            streams.map((stream) => {
              const progress = progressFor(stream);
              const canCancel = session?.address.toLowerCase() === stream.sender.toLowerCase() && stream.ruleType === "cancelable" && stream.active;
              const canClaim = Number(stream.releasable) > 0 && stream.active;

              return (
                <article key={stream.id} className="rounded-lg border border-[#EDEDED]/10 bg-[#151515] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[#ACC6E9]">Drift #{stream.id} · {stream.ruleType}</p>
                      <h2 className="mt-3 text-3xl">{stream.amount} USDC</h2>
                      <p className="mt-3 text-sm leading-6 text-[#AFAFAF]">
                        {formatAddress(stream.sender)} to {formatAddress(stream.recipient)} · {formatDate(stream.startTime)} to {formatDate(stream.endTime)}
                      </p>
                    </div>
                    <span className={`rounded-lg px-3 py-2 text-xs uppercase tracking-[0.16em] ${stream.active ? "bg-[#ACC6E9] text-[#050505]" : "bg-[#292929] text-[#AFAFAF]"}`}>
                      {stream.active ? "active" : "closed"}
                    </span>
                  </div>
                  <div className="mt-6">
                    <div className="flex flex-wrap justify-between gap-3 text-xs uppercase tracking-[0.18em] text-[#AFAFAF]">
                      <span>{Math.round(progress)}% unlocked</span>
                      <span>{stream.releasable} USDC claimable</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[#EDEDED]/10">
                      <div className="h-2 rounded-full bg-[#ACC6E9] transition-all duration-700" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={`${ARC_EXPLORER}/tx/${stream.createdTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-10 place-items-center rounded-lg border border-[#EDEDED]/10 px-4 text-xs uppercase tracking-[0.16em] text-[#EDEDED] transition hover:border-[#ACC6E9] hover:text-[#ACC6E9]"
                    >
                      View tx
                    </a>
                    <button
                      onClick={() => createActionChallenge("/api/execute-drift-challenge", stream.id)}
                      disabled={!canClaim || actionId === stream.id}
                      className="h-10 rounded-lg bg-[#EDEDED] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#050505] transition hover:bg-[#ACC6E9] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionId === stream.id ? "Confirming" : "Claim unlocked"}
                    </button>
                    <button
                      onClick={() => createActionChallenge("/api/cancel-drift-challenge", stream.id)}
                      disabled={!canCancel || actionId === stream.id}
                      className="h-10 rounded-lg border border-[#EDEDED]/10 px-4 text-xs uppercase tracking-[0.16em] text-[#EDEDED] transition hover:border-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="border-t border-[#EDEDED]/10 px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl">Transaction status</h2>
          <div className="mt-6 grid gap-3">
            {transactions.length === 0 ? (
              <p className="text-[#AFAFAF]">Transaction hashes appear here after history sync.</p>
            ) : transactions.map((transaction) => (
              <a
                key={`${transaction.label}-${transaction.hash}`}
                href={`${ARC_EXPLORER}/tx/${transaction.hash}`}
                target="_blank"
                rel="noreferrer"
                className="grid gap-2 rounded-lg border border-[#EDEDED]/10 bg-[#151515] p-4 transition hover:border-[#ACC6E9] md:grid-cols-[1fr_auto]"
              >
                <span>{transaction.label}</span>
                <span className="font-mono text-sm text-[#ACC6E9]">{transaction.status}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />

      {showLogin && (
        <LoginModal
          onLoginSuccess={(nextSession) => {
            setSession(nextSession);
            window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
            setShowLogin(false);
            void refreshHistory(nextSession);
          }}
        />
      )}
    </main>
  );
}
