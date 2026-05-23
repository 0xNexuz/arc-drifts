"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import LoginModal, { type CircleSession } from "./components/LoginModal";

const RECIPIENT_ADDRESS = "0x7034aF41397893321c4458ABB3B98F6c67065FaB";
const STREAM_AMOUNT_USDC_UNITS = "1000000";
const ONE_DAY_SECONDS = 86400;

type ChallengeResponse = {
  challengeId?: string;
  error?: string;
};

const workflow = [
  ["01", "Circle vault", "Email login creates or restores an SCA wallet on Arc Testnet."],
  ["02", "USDC approval", "The wallet signs a token approval challenge before funds move."],
  ["03", "Drift deploy", "A second challenge calls createDrift with exact stream terms."],
];

const rails = [
  "User-controlled wallet",
  "SCA account type",
  "ARC-TESTNET",
  "USDC approval",
  "Timed unlock",
];

function executeCircleChallenge(session: CircleSession, challengeId: string) {
  return import("@circle-fin/w3s-pw-web-sdk").then(({ W3SSdk }) => (
    new Promise<void>((resolve, reject) => {
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
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Circle challenge completed without a result"));
          return;
        }

        resolve();
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

  async function deployStream() {
    if (!circleSession) {
      setShowLogin(true);
      return;
    }

    setStreaming(true);
    setStreamStatus("Preparing USDC approval");

    try {
      const now = Math.floor(Date.now() / 1000);
      const approvalChallenge = await createChallenge("/api/approve-usdc-challenge", {
        userToken: circleSession.userToken,
        walletId: circleSession.walletId,
        amount: STREAM_AMOUNT_USDC_UNITS,
      });

      setStreamStatus("Approve USDC in Circle");
      await executeCircleChallenge(circleSession, approvalChallenge);

      setStreamStatus("Preparing stream contract call");
      const driftChallenge = await createChallenge("/api/create-drift-challenge", {
        userToken: circleSession.userToken,
        walletId: circleSession.walletId,
        recipient: RECIPIENT_ADDRESS,
        amount: STREAM_AMOUNT_USDC_UNITS,
        startTime: now,
        endTime: now + ONE_DAY_SECONDS,
        ruleType: 0,
      });

      setStreamStatus("Confirm stream in Circle");
      await executeCircleChallenge(circleSession, driftChallenge);
      setStreamStatus("Stream submitted");
    } catch (err: unknown) {
      console.error("Tx Error:", err);
      setStreamStatus(err instanceof Error ? err.message : "Transaction failed");
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
            <a href="#circle" className="transition hover:text-[#B8FF2C]">Circle</a>
            <a href="#deploy" className="transition hover:text-[#B8FF2C]">Deploy</a>
          </div>
          <button
            onClick={() => !circleSession && setShowLogin(true)}
            className="h-10 rounded-lg border border-[#F6F2E8]/15 px-4 text-sm text-[#F6F2E8] transition hover:border-[#B8FF2C] hover:text-[#B8FF2C]"
          >
            {circleSession ? circleSession.displayAddress : "Sign in"}
          </button>
        </div>
      </nav>

      <main id="top" className="relative">
        <section className="min-h-screen border-b border-[#F6F2E8]/10 pt-16">
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 gap-0 px-5 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div className="flex flex-col justify-center py-20" data-reveal>
              <p className="mb-6 w-fit border border-[#B8FF2C]/40 px-3 py-2 text-xs uppercase tracking-[0.24em] text-[#B8FF2C]">
                Circle programmable streams
              </p>
              <h1 className="max-w-4xl text-[clamp(3.4rem,10vw,9rem)] font-medium leading-[0.86] tracking-normal text-[#F6F2E8]">
                Money that moves by rule.
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-8 text-[#C7CEC4]">
                Create wallet-native USDC streams with a two-step Circle approval flow: authorize funds, then deploy the drift contract.
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
                  href="#workflow"
                  className="grid h-12 place-items-center rounded-lg border border-[#F6F2E8]/15 px-6 text-sm uppercase tracking-[0.18em] text-[#F6F2E8] transition hover:border-[#B8FF2C] hover:text-[#B8FF2C]"
                >
                  View Flow
                </a>
              </div>
            </div>

            <div className="relative flex items-center py-10 lg:py-20" data-reveal>
              <div className="arc-grid absolute inset-y-16 left-0 right-0 hidden border-x border-[#F6F2E8]/10 lg:block"></div>
              <div className="relative ml-auto w-full max-w-xl">
                <div className="rounded-lg border border-[#F6F2E8]/14 bg-[#0D1110] p-3 shadow-2xl shadow-black/40">
                  <div className="grid grid-cols-3 border-b border-[#F6F2E8]/10 text-xs uppercase tracking-[0.2em] text-[#7F8A80]">
                    <span className="p-3">Vault</span>
                    <span className="p-3">Rule</span>
                    <span className="p-3">State</span>
                  </div>
                  <div className="grid gap-3 p-3">
                    <div className="rounded-lg bg-[#F6F2E8] p-5 text-[#050607]">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#59645E]">
                        <span>Active stream</span>
                        <span>1 USDC</span>
                      </div>
                      <div className="mt-8 h-2 rounded-full bg-[#050607]/10">
                        <div className="h-2 w-2/3 rounded-full bg-[#B8FF2C]"></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#F6F2E8]/10 bg-[#151A18] p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#7F8A80]">Wallet</p>
                        <p className="mt-5 text-2xl">{circleSession?.displayAddress ?? "Not signed"}</p>
                      </div>
                      <div className="rounded-lg border border-[#B8FF2C]/35 bg-[#B8FF2C]/10 p-5">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#B8FF2C]">Status</p>
                        <p className="mt-5 text-2xl">{streamStatus}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-8 -left-8 hidden w-52 rounded-lg border border-[#F6F2E8]/12 bg-[#050607] p-4 text-sm text-[#C7CEC4] shadow-xl shadow-black/40 md:block">
                  <span className="text-[#B8FF2C]">01</span> No shortened addresses enter the transaction path.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-[#F6F2E8]/10 px-5 py-28 lg:px-8">
          <div className="mx-auto max-w-7xl" data-reveal>
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#B8FF2C]">Execution sequence</p>
                <h2 className="mt-5 max-w-md text-5xl font-medium leading-tight">A slower-looking flow that fails less.</h2>
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

        <section id="circle" className="border-b border-[#F6F2E8]/10 bg-[#F6F2E8] px-5 py-28 text-[#050607] lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1fr]" data-reveal>
            <div className="order-2 grid content-start gap-3 lg:order-1">
              {rails.map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-lg border border-[#050607]/12 p-5">
                  <span className="text-sm uppercase tracking-[0.18em]">{item}</span>
                  <span className="font-mono text-[#59645E]">{String(index + 1).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[#4F6F14]">Circle rail</p>
              <h2 className="mt-5 max-w-xl text-6xl font-medium leading-none">The wallet is the product surface.</h2>
              <p className="mt-8 max-w-lg text-lg leading-8 text-[#4D574F]">
                The UI now keeps the full wallet address, stores the wallet id, and signs each contract action through Circle challenges.
              </p>
            </div>
          </div>
        </section>

        <section id="deploy" className="px-5 py-28 lg:px-8">
          <div className="mx-auto max-w-7xl" data-reveal>
            <div className="grid overflow-hidden rounded-lg border border-[#F6F2E8]/12 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="bg-[#B8FF2C] p-8 text-[#050607] md:p-12">
                <p className="text-xs uppercase tracking-[0.24em]">Deploy panel</p>
                <h2 className="mt-6 text-5xl font-medium leading-none">One action. Two signatures.</h2>
                <button
                  onClick={deployStream}
                  disabled={streaming}
                  className="mt-10 h-12 rounded-lg bg-[#050607] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#F6F2E8] transition hover:bg-[#151A18] disabled:cursor-wait disabled:opacity-70"
                >
                  {circleSession ? "Run Stream" : "Sign In First"}
                </button>
              </div>
              <div className="grid gap-px bg-[#F6F2E8]/10">
                {[
                  ["Recipient", RECIPIENT_ADDRESS],
                  ["Amount", "1 USDC"],
                  ["Duration", "24 hours"],
                  ["Current state", streamStatus],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-2 bg-[#0D1110] p-6 md:grid-cols-[10rem_1fr]">
                    <span className="text-xs uppercase tracking-[0.2em] text-[#7F8A80]">{label}</span>
                    <span className="break-all font-mono text-sm text-[#F6F2E8]">{value}</span>
                  </div>
                ))}
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
            setShowLogin(false);
          }}
        />
      )}
    </div>
  );
}

