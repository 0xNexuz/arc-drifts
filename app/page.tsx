"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { isAddress, parseUnits } from "viem";
import LoginModal, { type CircleSession } from "./components/LoginModal";

const RECIPIENT_ADDRESS = "0x7034aF41397893321c4458ABB3B98F6c67065FaB";
const ARC_EXPLORER = "https://testnet.arcscan.app";
const CIRCLE_FAUCET = "https://faucet.circle.com";

type StreamType = "streaming" | "delayed" | "cancelable" | "recurring";
type TimeUnit = "minutes" | "hours" | "days";

type ChallengeResponse = {
  challengeId?: string;
  error?: string;
};

type CircleChallengeProof = {
  type?: string;
  status?: string;
  txHash?: string;
  signedTransaction?: string;
};

type TxProof = {
  label: string;
  hash?: string;
  status?: string;
  type?: string;
};

const streamTypes: Array<{
  id: StreamType;
  label: string;
  ruleType: number | null;
  note: string;
}> = [
  { id: "streaming", label: "Streaming payment", ruleType: 0, note: "Linear unlock between start and end." },
  { id: "delayed", label: "Delayed transfer", ruleType: 1, note: "Full amount unlocks after the deadline." },
  { id: "cancelable", label: "Cancellable transfer", ruleType: 2, note: "Uses the current cancelable enum; cancel action still needs the contract upgrade." },
  { id: "recurring", label: "Recurring payment", ruleType: null, note: "Needs a recurring scheduler in the contract before it can run live." },
];

const timeMultipliers: Record<TimeUnit, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
};

const workflow = [
  ["01", "Connect", "Email login creates or restores a Circle SCA wallet on Arc Testnet."],
  ["02", "Fund", "Request Arc Testnet USDC from the in-app faucet action or open Circle Faucet."],
  ["03", "Configure", "Choose recipient, USDC amount, transfer type, delay, and duration."],
  ["04", "Prove", "Circle returns transaction proof for approval and drift creation."],
];

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Transaction failed";
}

function secondsFrom(value: string, unit: TimeUnit) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Time values must be zero or greater");
  }

  return Math.max(0, Math.round(parsed * timeMultipliers[unit]));
}

function executeCircleChallenge(session: CircleSession, challengeId: string) {
  return import("@circle-fin/w3s-pw-web-sdk").then(({ W3SSdk }) => (
    new Promise<CircleChallengeProof>((resolve, reject) => {
      const sdk = new W3SSdk();
      const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

      if (!appId) {
        reject(new Error("NEXT_PUBLIC_CIRCLE_APP_ID is not configured"));
        return;
      }

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

        const data = ("data" in result ? result.data : undefined) as {
          txHash?: string;
          signedTransaction?: string;
        } | undefined;
        resolve({
          type: String(result.type ?? ""),
          status: String(result.status ?? ""),
          txHash: data?.txHash,
          signedTransaction: data?.signedTransaction,
        });
      });
    })
  ));
}

async function createChallenge(path: string, body: Record<string, string | number>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as ChallengeResponse;

  if (!res.ok || !data.challengeId) {
    throw new Error(data.error ?? "Circle did not return a challenge");
  }

  return data.challengeId;
}

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);
  const [circleSession, setCircleSession] = useState<CircleSession | null>(null);
  const [streamStatus, setStreamStatus] = useState("Ready for wallet");
  const [streaming, setStreaming] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetStatus, setFaucetStatus] = useState("Request test USDC after connecting.");
  const [recipient, setRecipient] = useState(RECIPIENT_ADDRESS);
  const [amount, setAmount] = useState("1");
  const [streamType, setStreamType] = useState<StreamType>("streaming");
  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<TimeUnit>("hours");
  const [delayValue, setDelayValue] = useState("0");
  const [delayUnit, setDelayUnit] = useState<TimeUnit>("minutes");
  const [proofs, setProofs] = useState<TxProof[]>([]);

  const selectedType = useMemo(
    () => streamTypes.find((type) => type.id === streamType) ?? streamTypes[0],
    [streamType],
  );

  const amountUnits = useMemo(() => {
    try {
      return parseUnits(amount || "0", 6).toString();
    } catch {
      return "0";
    }
  }, [amount]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.18 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function disconnect() {
    setCircleSession(null);
    setProofs([]);
    setStreamStatus("Wallet disconnected");
    setFaucetStatus("Request test USDC after connecting.");
  }

  async function requestFaucetTokens() {
    if (!circleSession) {
      setShowLogin(true);
      return;
    }

    setFaucetLoading(true);
    setFaucetStatus("Requesting Arc Testnet USDC");

    try {
      const res = await fetch("/api/request-faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: circleSession.address, usdc: true, native: false }),
      });
      const data = await res.json() as { message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Faucet request failed");
      }

      setFaucetStatus(data.message ?? "Faucet request submitted");
    } catch (error: unknown) {
      setFaucetStatus(`${getErrorMessage(error)}. You can still use Circle Faucet manually.`);
    } finally {
      setFaucetLoading(false);
    }
  }

  async function deployStream() {
    if (!circleSession) {
      setShowLogin(true);
      return;
    }

    if (selectedType.ruleType === null) {
      setStreamStatus("Recurring payments need a contract upgrade before live deployment.");
      return;
    }

    if (!isAddress(recipient)) {
      setStreamStatus("Recipient address is invalid");
      return;
    }

    const parsedAmount = parseUnits(amount || "0", 6);

    if (parsedAmount <= 0n) {
      setStreamStatus("Amount must be greater than 0 USDC");
      return;
    }

    setStreaming(true);
    setProofs([]);
    setStreamStatus("Preparing USDC approval");

    try {
      const now = Math.floor(Date.now() / 1000);
      const delaySeconds = secondsFrom(delayValue, delayUnit);
      const durationSeconds = Math.max(60, secondsFrom(durationValue, durationUnit));
      const startTime = now + delaySeconds;
      const endTime = selectedType.id === "delayed" || selectedType.id === "cancelable"
        ? startTime + durationSeconds
        : startTime + durationSeconds;

      const approvalChallenge = await createChallenge("/api/approve-usdc-challenge", {
        userToken: circleSession.userToken,
        walletId: circleSession.walletId,
        amount: parsedAmount.toString(),
      });

      setStreamStatus("Approve USDC in Circle");
      const approvalProof = await executeCircleChallenge(circleSession, approvalChallenge);
      setProofs([{ label: "USDC approval", hash: approvalProof.txHash, status: approvalProof.status, type: approvalProof.type }]);

      setStreamStatus("Preparing stream contract call");
      const driftChallenge = await createChallenge("/api/create-drift-challenge", {
        userToken: circleSession.userToken,
        walletId: circleSession.walletId,
        recipient,
        amount: parsedAmount.toString(),
        startTime,
        endTime,
        ruleType: selectedType.ruleType,
      });

      setStreamStatus("Confirm stream in Circle");
      const driftProof = await executeCircleChallenge(circleSession, driftChallenge);
      setProofs((current) => [
        ...current,
        { label: selectedType.label, hash: driftProof.txHash, status: driftProof.status, type: driftProof.type },
      ]);
      setStreamStatus("Stream submitted with transaction proof");
    } catch (err: unknown) {
      console.error("Tx Error:", err);
      setStreamStatus(getErrorMessage(err));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050607] text-[#F6F2E8] selection:bg-[#B8FF2C] selection:text-black">
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-[#F6F2E8]/10 bg-[#050607]/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Arc Drift home">
            <Image src="/arc-drift-logo.svg" alt="" width={32} height={32} priority />
            <span className="text-sm font-semibold uppercase tracking-[0.28em]">Arc Drift</span>
          </a>
          <div className="hidden items-center gap-8 text-xs uppercase tracking-[0.22em] text-[#A6AFA5] md:flex">
            <a href="#workflow" className="transition hover:text-[#B8FF2C]">Flow</a>
            <a href="#fund" className="transition hover:text-[#B8FF2C]">Faucet</a>
            <a href="#deploy" className="transition hover:text-[#B8FF2C]">Deploy</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => !circleSession && setShowLogin(true)}
              className="h-10 rounded-lg border border-[#F6F2E8]/15 px-4 text-sm text-[#F6F2E8] transition hover:border-[#B8FF2C] hover:text-[#B8FF2C]"
            >
              {circleSession ? circleSession.displayAddress : "Sign in"}
            </button>
            {circleSession && (
              <button
                onClick={disconnect}
                className="h-10 rounded-lg bg-[#F6F2E8] px-4 text-sm font-semibold text-[#050607] transition hover:bg-[#B8FF2C]"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </nav>

      <main id="top" className="relative">
        <section className="min-h-screen border-b border-[#F6F2E8]/10 pt-16">
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 gap-10 px-5 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <div className="flex flex-col justify-center py-20" data-reveal>
              <p className="mb-6 w-fit border border-[#B8FF2C]/40 px-3 py-2 text-xs uppercase tracking-[0.24em] text-[#B8FF2C]">
                Circle programmable streams
              </p>
              <h1 className="max-w-4xl text-[clamp(3.2rem,9vw,8rem)] font-medium leading-[0.88] tracking-normal text-[#F6F2E8]">
                Pick the rule. Prove the transfer.
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-8 text-[#C7CEC4]">
                Configure Arc Testnet USDC movement from the app: fund your wallet, select timing, sign with Circle, and keep the transaction hash.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={deployStream}
                  disabled={streaming}
                  className="h-12 rounded-lg bg-[#B8FF2C] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#050607] transition hover:bg-[#F6F2E8] disabled:cursor-wait disabled:opacity-70"
                >
                  {streaming ? "Processing" : "Deploy Stream"}
                </button>
                <a
                  href="#fund"
                  className="grid h-12 place-items-center rounded-lg border border-[#F6F2E8]/15 px-6 text-sm uppercase tracking-[0.18em] text-[#F6F2E8] transition hover:border-[#B8FF2C] hover:text-[#B8FF2C]"
                >
                  Get Test USDC
                </a>
              </div>
            </div>

            <div className="relative flex items-center py-10 lg:py-20" data-reveal>
              <div className="arc-grid absolute inset-y-16 left-0 right-0 hidden border-x border-[#F6F2E8]/10 lg:block"></div>
              <div className="relative ml-auto w-full">
                <div className="rounded-lg border border-[#F6F2E8]/14 bg-[#0D1110] p-3 shadow-2xl shadow-black/40">
                  <div className="grid grid-cols-3 border-b border-[#F6F2E8]/10 text-xs uppercase tracking-[0.2em] text-[#7F8A80]">
                    <span className="p-3">Wallet</span>
                    <span className="p-3">Type</span>
                    <span className="p-3">State</span>
                  </div>
                  <div className="grid gap-3 p-3">
                    <div className="rounded-lg bg-[#F6F2E8] p-5 text-[#050607]">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-[#59645E]">
                        <span>{selectedType.label}</span>
                        <span>{amount || "0"} USDC</span>
                      </div>
                      <div className="mt-8 grid gap-2 text-sm text-[#303832]">
                        <span>Recipient: {isAddress(recipient) ? formatAddress(recipient) : "Invalid address"}</span>
                        <span>Window: {delayValue} {delayUnit} delay, {durationValue} {durationUnit} duration</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#F6F2E8]/10 bg-[#151A18] p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#7F8A80]">Connected</p>
                        <p className="mt-5 break-all text-2xl">{circleSession?.displayAddress ?? "Not signed"}</p>
                      </div>
                      <div className="rounded-lg border border-[#B8FF2C]/35 bg-[#B8FF2C]/10 p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#B8FF2C]">Status</p>
                        <p className="mt-5 text-xl leading-7">{streamStatus}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-[#F6F2E8]/10 px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-7xl" data-reveal>
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#B8FF2C]">Execution sequence</p>
                <h2 className="mt-5 max-w-md text-5xl font-medium leading-tight">The user sees every moving part.</h2>
              </div>
              <div className="grid gap-px overflow-hidden rounded-lg border border-[#F6F2E8]/10 bg-[#F6F2E8]/10">
                {workflow.map(([step, title, body]) => (
                  <div key={step} className="grid gap-5 bg-[#0D1110] p-6 md:grid-cols-[7rem_1fr]">
                    <span className="font-mono text-4xl text-[#B8FF2C]">{step}</span>
                    <div>
                      <h3 className="text-2xl">{title}</h3>
                      <p className="mt-3 max-w-2xl leading-7 text-[#A6AFA5]">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="fund" className="border-b border-[#F6F2E8]/10 bg-[#F6F2E8] px-5 py-24 text-[#050607] lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1fr]" data-reveal>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#4F6F14]">Arc Testnet faucet</p>
              <h2 className="mt-5 max-w-xl text-6xl font-medium leading-none">Fund the connected wallet without leaving the flow.</h2>
              <p className="mt-8 max-w-lg text-lg leading-8 text-[#4D574F]">
                The app requests test USDC for the Circle wallet, and the public Circle Faucet remains one click away when rate limits or console permissions get in the way.
              </p>
            </div>
            <div className="grid content-start gap-3">
              <div className="rounded-lg border border-[#050607]/12 p-5">
                <span className="text-xs uppercase tracking-[0.18em] text-[#59645E]">Wallet</span>
                <p className="mt-4 break-all font-mono text-sm">{circleSession?.address ?? "Connect wallet first"}</p>
              </div>
              <div className="rounded-lg border border-[#050607]/12 p-5">
                <span className="text-xs uppercase tracking-[0.18em] text-[#59645E]">Faucet state</span>
                <p className="mt-4 leading-7">{faucetStatus}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={requestFaucetTokens}
                  disabled={faucetLoading}
                  className="h-12 rounded-lg bg-[#050607] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#F6F2E8] transition hover:bg-[#1A211E] disabled:cursor-wait disabled:opacity-70"
                >
                  {faucetLoading ? "Requesting" : "Request USDC"}
                </button>
                <a
                  href={CIRCLE_FAUCET}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-12 place-items-center rounded-lg border border-[#050607]/15 px-5 text-sm font-semibold uppercase tracking-[0.16em] transition hover:border-[#4F6F14]"
                >
                  Open Circle Faucet
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="deploy" className="px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-7xl" data-reveal>
            <div className="grid overflow-hidden rounded-lg border border-[#F6F2E8]/12 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-[#B8FF2C] p-8 text-[#050607] md:p-10">
                <p className="text-xs uppercase tracking-[0.24em]">Deploy panel</p>
                <h2 className="mt-6 text-5xl font-medium leading-none">Configure the money rule.</h2>
                <div className="mt-8 grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold">
                    Recipient
                    <input value={recipient} onChange={(event) => setRecipient(event.currentTarget.value)} className="h-12 rounded-lg border border-[#050607]/15 bg-[#F6F2E8] px-4 font-mono text-sm outline-none focus:border-[#050607]" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Amount in USDC
                    <input value={amount} onChange={(event) => setAmount(event.currentTarget.value)} inputMode="decimal" className="h-12 rounded-lg border border-[#050607]/15 bg-[#F6F2E8] px-4 outline-none focus:border-[#050607]" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold">
                      Start delay
                      <div className="grid grid-cols-[1fr_auto] overflow-hidden rounded-lg border border-[#050607]/15 bg-[#F6F2E8]">
                        <input value={delayValue} onChange={(event) => setDelayValue(event.currentTarget.value)} inputMode="decimal" className="h-12 bg-transparent px-4 outline-none" />
                        <select value={delayUnit} onChange={(event) => setDelayUnit(event.currentTarget.value as TimeUnit)} className="h-12 bg-[#E8E3D6] px-3 outline-none">
                          <option value="minutes">min</option>
                          <option value="hours">hr</option>
                          <option value="days">day</option>
                        </select>
                      </div>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Time frame
                      <div className="grid grid-cols-[1fr_auto] overflow-hidden rounded-lg border border-[#050607]/15 bg-[#F6F2E8]">
                        <input value={durationValue} onChange={(event) => setDurationValue(event.currentTarget.value)} inputMode="decimal" className="h-12 bg-transparent px-4 outline-none" />
                        <select value={durationUnit} onChange={(event) => setDurationUnit(event.currentTarget.value as TimeUnit)} className="h-12 bg-[#E8E3D6] px-3 outline-none">
                          <option value="minutes">min</option>
                          <option value="hours">hr</option>
                          <option value="days">day</option>
                        </select>
                      </div>
                    </label>
                  </div>
                </div>
                <button
                  onClick={deployStream}
                  disabled={streaming}
                  className="mt-8 h-12 rounded-lg bg-[#050607] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#F6F2E8] transition hover:bg-[#151A18] disabled:cursor-wait disabled:opacity-70"
                >
                  {circleSession ? "Run Stream" : "Sign In First"}
                </button>
              </div>

              <div className="grid gap-px bg-[#F6F2E8]/10">
                <div className="grid gap-3 bg-[#0D1110] p-6">
                  <span className="text-xs uppercase tracking-[0.2em] text-[#7F8A80]">Transfer type</span>
                  <div className="grid gap-3 md:grid-cols-2">
                    {streamTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setStreamType(type.id)}
                        className={`rounded-lg border p-4 text-left transition ${streamType === type.id ? "border-[#B8FF2C] bg-[#B8FF2C]/10" : "border-[#F6F2E8]/10 bg-[#151A18] hover:border-[#B8FF2C]/50"}`}
                      >
                        <span className="text-sm font-semibold text-[#F6F2E8]">{type.label}</span>
                        <span className="mt-3 block text-sm leading-6 text-[#A6AFA5]">{type.note}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  ["Amount units", amountUnits],
                  ["Current state", streamStatus],
                  ["Connected wallet", circleSession?.address ?? "Not connected"],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-2 bg-[#0D1110] p-6 md:grid-cols-[10rem_1fr]">
                    <span className="text-xs uppercase tracking-[0.2em] text-[#7F8A80]">{label}</span>
                    <span className="break-all font-mono text-sm text-[#F6F2E8]">{value}</span>
                  </div>
                ))}

                <div className="grid gap-3 bg-[#0D1110] p-6">
                  <span className="text-xs uppercase tracking-[0.2em] text-[#7F8A80]">Transaction proof</span>
                  {proofs.length === 0 ? (
                    <p className="text-sm text-[#A6AFA5]">Hashes appear here after Circle signs and submits each transaction.</p>
                  ) : (
                    proofs.map((proof) => (
                      <div key={`${proof.label}-${proof.hash ?? proof.status}`} className="rounded-lg border border-[#F6F2E8]/10 bg-[#151A18] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{proof.label}</span>
                          <span className="text-xs uppercase tracking-[0.16em] text-[#B8FF2C]">{proof.status || "submitted"}</span>
                        </div>
                        {proof.hash ? (
                          <a href={`${ARC_EXPLORER}/tx/${proof.hash}`} target="_blank" rel="noreferrer" className="mt-3 block break-all font-mono text-sm text-[#B8FF2C] hover:text-[#F6F2E8]">
                            {formatHash(proof.hash)}
                          </a>
                        ) : (
                          <p className="mt-3 text-sm text-[#A6AFA5]">Circle completed the challenge, but no tx hash was returned yet.</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {showLogin && (
        <LoginModal
          onLoginSuccess={(session) => {
            setCircleSession(session);
            setStreamStatus("Wallet connected");
            setFaucetStatus(`Ready to request test USDC for ${formatAddress(session.address)}.`);
            setShowLogin(false);
          }}
        />
      )}
    </div>
  );
}
