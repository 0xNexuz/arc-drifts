"use client";

import { useState } from "react";
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

export type CircleSession = {
  userToken: string;
  encryptionKey: string;
  walletId: string;
  address: string;
  displayAddress: string;
  email?: string;
};

type CircleAuthResponse = {
  userToken?: string;
  encryptionKey?: string;
  challengeId?: string;
  wallet?: {
    id?: string;
    address?: string;
  };
  error?: string;
};

type WalletResponse = {
  walletId?: string | null;
  address?: string | null;
  blockchain?: string | null;
  walletCount?: number;
  availableBlockchains?: string[];
  error?: string;
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getClientErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = "message" in error ? error.message : undefined;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Login failed";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function executeCircleChallenge(sdk: W3SSdk, challengeId: string) {
  return new Promise<void>((resolve, reject) => {
    sdk.execute(challengeId, (error, result) => {
      if (error) {
        reject(new Error(getClientErrorMessage(error)));
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

async function fetchWallet(userToken: string) {
  const walletRes = await fetch("/api/get-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userToken }),
  });

  const walletData = await walletRes.json() as WalletResponse;

  if (!walletRes.ok) {
    throw new Error(walletData.error ?? "Failed to fetch Circle wallet");
  }

  return walletData;
}

async function fetchWalletWithRetry(userToken: string) {
  let latestWallet: WalletResponse | null = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    latestWallet = await fetchWallet(userToken);

    if (latestWallet.address && latestWallet.walletId) {
      return latestWallet;
    }

    await wait(attempt < 4 ? 1200 : 2200);
  }

  const seenBlockchains = latestWallet?.availableBlockchains?.length
    ? ` Seen wallets: ${latestWallet.availableBlockchains.join(", ")}.`
    : "";

  throw new Error(`Circle finished PIN setup, but the Arc Testnet wallet is still provisioning. Wait a few seconds and try signing in again.${seenBlockchains}`);
}

export default function LoginModal({ onLoginSuccess }: { onLoginSuccess: (session: CircleSession) => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/circle-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json() as CircleAuthResponse;

      if (!res.ok) {
        throw new Error(data.error ?? "Circle authentication failed");
      }

      if (!data.userToken || !data.encryptionKey) {
        throw new Error("Circle did not return login credentials");
      }

      const sdk = new W3SSdk();
      const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

      if (!appId) {
        throw new Error("NEXT_PUBLIC_CIRCLE_APP_ID is not configured");
      }

      sdk.setAppSettings({ appId });
      sdk.setAuthentication({
        userToken: data.userToken,
        encryptionKey: data.encryptionKey,
      });

      if (data.challengeId) {
        setStep(2);
        await executeCircleChallenge(sdk, data.challengeId);
      }

      const walletData = await fetchWalletWithRetry(data.userToken);

      const address = walletData.address ?? data.wallet?.address;
      const walletId = walletData.walletId ?? data.wallet?.id;

      if (!address || !walletId) {
        throw new Error("Circle wallet was not created yet. Try signing in again.");
      }

      onLoginSuccess({
        userToken: data.userToken,
        encryptionKey: data.encryptionKey,
        walletId,
        address,
        displayAddress: formatAddress(address),
        email,
      });
    } catch (error: unknown) {
      console.error("Login Error:", error);
      setErrorMessage(getClientErrorMessage(error));
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#151515] border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#ACC6E9] rounded-full blur-[80px] opacity-30"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#D5E0E7] rounded-full blur-[80px] opacity-30"></div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ACC6E9] to-[#D5E0E7] flex items-center justify-center shadow-lg mb-6">
            <div className="w-4 h-5 border-2 border-white rounded-t-full border-b-0 mt-1"></div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {step === 1 ? "Welcome to Arc Drift" : "Securing your Vault"}
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            {step === 1 ? "Enter your email to access zero-gas streaming." : "Follow the prompts to encrypt your device."}
          </p>

          {errorMessage && (
            <p className="w-full text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
              {errorMessage}
            </p>
          )}

          {step === 1 && (
            <form onSubmit={handleEmailLogin} className="w-full flex flex-col gap-4">
              <input
                type="email"
                placeholder="magnus@vibecoder.com"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                className="w-full bg-black/40 border border-white/10 text-white p-4 rounded-xl focus:outline-none focus:border-[#ACC6E9] focus:ring-1 focus:ring-[#ACC6E9] transition-all"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#ACC6E9] to-[#D5E0E7] text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(172,198,233,0.24)] hover:shadow-[0_0_30px_rgba(213,224,231,0.36)] disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Continue with Email"}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="w-full flex flex-col items-center py-6">
              <div className="w-10 h-10 border-4 border-[#ACC6E9] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 text-xs tracking-widest uppercase mt-6 font-mono">Awaiting Signature</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


