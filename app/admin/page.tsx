"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import LoginModal, { type CircleSession } from "../components/LoginModal";
import SiteFooter from "../components/SiteFooter";
import type { StreamHistoryStream, StreamHistoryTransaction } from "../../lib/arcDrift";

const ARC_EXPLORER = "https://testnet.arcscan.app";
const SESSION_STORAGE_KEY = "arc-drift-circle-session";

type AdminSummary = {
  metrics?: {
    streamsCreated: number;
    activeStreams: number;
    completedStreams: number;
    walletsSeen: number;
    totalUsdcVolume: string;
    totalUsdcWithdrawn: string;
    transactionCount: number;
    cancelTransactions: number;
  };
  streams?: StreamHistoryStream[];
  transactions?: StreamHistoryTransaction[];
  note?: string;
  error?: string;
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<CircleSession | null>(() => readStoredSession());
  const [showLogin, setShowLogin] = useState(false);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [status, setStatus] = useState("Sign in with your allowed admin wallet, then enter the admin password.");
  const [loading, setLoading] = useState(false);

  async function loadSummary(event?: React.FormEvent) {
    event?.preventDefault();
    if (!session) {
      setStatus("Admin Circle login is required before the snapshot can load.");
      setShowLogin(true);
      return;
    }

    setLoading(true);
    setStatus("Loading admin snapshot");

    try {
      const res = await fetch("/api/admin/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          userToken: session.userToken,
          walletAddress: session.address,
        }),
      });
      const data = await res.json() as AdminSummary;

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load admin dashboard");
      }

      setSummary(data);
      setStatus("Admin snapshot synced from Arc Testnet events.");
    } catch (error: unknown) {
      setSummary(null);
      setStatus(error instanceof Error ? error.message : "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setSummary(null);
    setStatus("Admin wallet disconnected.");
  }

  return (
    <main className="min-h-screen bg-[#050505] text-[#EDEDED]">
      <nav className="border-b border-[#EDEDED]/10 bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Arc Drift home">
            <Image src="/arc-drift-logo.svg" alt="" width={32} height={32} priority />
            <span className="text-sm font-semibold uppercase tracking-[0.28em]">Arc Drift</span>
          </Link>
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-[#AFAFAF]">
            <Link href="/dashboard" className="transition hover:text-[#ACC6E9]">Dashboard</Link>
            <Link href="/docs" className="transition hover:text-[#ACC6E9]">Docs</Link>
          </div>
        </div>
      </nav>

      <section className="border-b border-[#EDEDED]/10 px-5 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">Private operator view</p>
            <h1 className="mt-5 max-w-2xl text-6xl font-medium leading-none">Admin dashboard.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#CFCFCF]">
              Wallet-verified V2 snapshot for streams, wallets, USDC volume, transaction hashes, and protocol activity.
            </p>
          </div>
          <form onSubmit={loadSummary} className="grid content-start gap-3 rounded-lg border border-[#EDEDED]/12 bg-[#151515] p-4">
            <div className="rounded-lg border border-[#EDEDED]/10 bg-[#050505] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#AFAFAF]">Admin wallet</p>
              <p className="mt-3 break-all font-mono text-sm text-[#EDEDED]">
                {session?.address ?? "Not connected"}
              </p>
              <button
                type="button"
                onClick={() => session ? disconnect() : setShowLogin(true)}
                className="mt-4 h-10 rounded-lg border border-[#EDEDED]/10 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#EDEDED] transition hover:border-[#ACC6E9] hover:text-[#ACC6E9]"
              >
                {session ? "Disconnect" : "Sign in"}
              </button>
            </div>
            <label className="grid gap-2 text-sm font-semibold">
              Admin password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                className="h-12 rounded-lg border border-[#EDEDED]/10 bg-[#050505] px-4 text-[#EDEDED] outline-none focus:border-[#ACC6E9]"
                placeholder="Set ADMIN_DASHBOARD_PASSWORD in Vercel"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !session}
              className="h-12 rounded-lg bg-[#ACC6E9] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#050505] transition hover:bg-[#EDEDED] disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? "Loading" : "Open admin"}
            </button>
            <p className="rounded-lg bg-[#292929] p-4 text-sm leading-6 text-[#AFAFAF]">{status}</p>
          </form>
        </div>
      </section>

      {summary?.metrics && (
        <>
          <section className="border-b border-[#EDEDED]/10 px-5 py-16 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-4">
              {[
                ["Streams", summary.metrics.streamsCreated.toString()],
                ["Active", summary.metrics.activeStreams.toString()],
                ["Wallets", summary.metrics.walletsSeen.toString()],
                ["USDC volume", summary.metrics.totalUsdcVolume],
                ["Withdrawn", summary.metrics.totalUsdcWithdrawn],
                ["Transactions", summary.metrics.transactionCount.toString()],
                ["Completed", summary.metrics.completedStreams.toString()],
                ["Canceled tx", summary.metrics.cancelTransactions.toString()],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#EDEDED]/10 bg-[#151515] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#AFAFAF]">{label}</p>
                  <p className="mt-4 break-all text-3xl text-[#EDEDED]">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-b border-[#EDEDED]/10 px-5 py-16 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">Streams</p>
                  <h2 className="mt-4 text-4xl">Latest contract activity</h2>
                </div>
                <p className="max-w-lg text-sm leading-6 text-[#AFAFAF]">{summary.note}</p>
              </div>
              <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-[#EDEDED]/10 bg-[#EDEDED]/10">
                {(summary.streams ?? []).slice(0, 12).map((stream) => (
                  <div key={stream.id} className="grid gap-3 bg-[#151515] p-5 md:grid-cols-[7rem_1fr_1fr_8rem]">
                    <span className="font-mono text-[#ACC6E9]">#{stream.id}</span>
                    <span>{formatAddress(stream.sender)} to {formatAddress(stream.recipient)}</span>
                    <span className="text-[#AFAFAF]">{stream.amount} USDC · {stream.ruleType}</span>
                    <span className={stream.active ? "text-[#ACC6E9]" : "text-[#AFAFAF]"}>{stream.active ? "active" : "closed"}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-5 py-16 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">Transaction hashes</p>
              <div className="mt-8 grid gap-3">
                {(summary.transactions ?? []).slice(0, 12).map((transaction) => (
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
        </>
      )}

      <SiteFooter />
      {showLogin && (
        <LoginModal
          onLoginSuccess={(nextSession) => {
            setSession(nextSession);
            setShowLogin(false);
            window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
            setStatus("Admin wallet connected. Enter the admin password to load the snapshot.");
          }}
        />
      )}
    </main>
  );
}
