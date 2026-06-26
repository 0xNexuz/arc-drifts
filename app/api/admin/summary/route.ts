import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import { NextResponse } from "next/server";
import { getDriftHistory } from "../../../../lib/arcDrift";

type AdminSummaryRequest = {
  password?: string;
  userToken?: string;
  walletAddress?: string;
};

type CircleWallet = {
  address?: string;
  blockchain?: string;
};

const BLOCKCHAIN = "ARC-TESTNET";

function parseAllowedWallets() {
  return new Set(
    (process.env.ADMIN_ALLOWED_WALLETS ?? "")
      .split(",")
      .map((wallet) => wallet.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function verifyAdminWallet(userToken: string | undefined, walletAddress: string | undefined) {
  const allowedWallets = parseAllowedWallets();
  const normalizedWallet = walletAddress?.trim().toLowerCase();

  if (allowedWallets.size === 0) {
    return { ok: false, status: 500, error: "ADMIN_ALLOWED_WALLETS is not configured" };
  }

  if (!userToken || !normalizedWallet) {
    return { ok: false, status: 401, error: "Admin Circle login is required" };
  }

  if (!allowedWallets.has(normalizedWallet)) {
    return { ok: false, status: 403, error: "This wallet is not allowed to access admin" };
  }

  if (!process.env.CIRCLE_API_KEY) {
    return { ok: false, status: 500, error: "CIRCLE_API_KEY is not configured" };
  }

  const circleClient = initiateUserControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
  });

  const walletsResponse = await circleClient.listWallets({
    userToken,
    blockchain: BLOCKCHAIN,
  });

  const tokenOwnsWallet = walletsResponse.data?.wallets?.some((wallet: CircleWallet) => (
    wallet.blockchain === BLOCKCHAIN && wallet.address?.toLowerCase() === normalizedWallet
  ));

  if (!tokenOwnsWallet) {
    return { ok: false, status: 403, error: "Admin wallet could not be verified with Circle" };
  }

  return { ok: true, status: 200, error: null };
}

function sumUnits(values: string[]) {
  return values.reduce((total, value) => total + BigInt(value), 0n);
}

function formatUsdc(rawUnits: bigint) {
  const whole = rawUnits / 1_000_000n;
  const fraction = rawUnits % 1_000_000n;
  const fractionText = fraction.toString().padStart(6, "0").replace(/0+$/, "");
  return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
}

export async function POST(req: Request) {
  try {
    const { password, userToken, walletAddress } = await req.json() as AdminSummaryRequest;
    const adminPassword = process.env.ADMIN_DASHBOARD_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ error: "ADMIN_DASHBOARD_PASSWORD is not configured" }, { status: 500 });
    }

    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
    }

    const adminWallet = await verifyAdminWallet(userToken, walletAddress);
    if (!adminWallet.ok) {
      return NextResponse.json({ error: adminWallet.error }, { status: adminWallet.status });
    }

    const history = await getDriftHistory(undefined, 100);
    const wallets = new Set<string>();

    history.streams.forEach((stream) => {
      wallets.add(stream.sender.toLowerCase());
      wallets.add(stream.recipient.toLowerCase());
    });

    const totalVolumeUnits = sumUnits(history.streams.map((stream) => stream.amountUnits));
    const totalWithdrawnUnits = sumUnits(history.streams.map((stream) => stream.withdrawnUnits));
    const activeStreams = history.streams.filter((stream) => stream.active).length;
    const cancelTransactions = history.transactions.filter((tx) => tx.status === "canceled").length;

    return NextResponse.json({
      metrics: {
        streamsCreated: history.streams.length,
        activeStreams,
        completedStreams: Math.max(0, history.streams.length - activeStreams),
        walletsSeen: wallets.size,
        totalUsdcVolume: formatUsdc(totalVolumeUnits),
        totalUsdcWithdrawn: formatUsdc(totalWithdrawnUnits),
        transactionCount: history.transactions.length,
        cancelTransactions,
      },
      streams: history.streams,
      transactions: history.transactions,
      note: "No database is connected yet, so this snapshot is reconstructed from Arc Drift contract events.",
    });
  } catch (error: unknown) {
    console.error("Admin Summary Error:", error);
    const message = error instanceof Error ? error.message : "Failed to load admin summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
