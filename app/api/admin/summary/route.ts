import { NextResponse } from "next/server";
import { getDriftHistory } from "../../../../lib/arcDrift";

type AdminSummaryRequest = {
  password?: string;
};

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
    const { password } = await req.json() as AdminSummaryRequest;
    const adminPassword = process.env.ADMIN_DASHBOARD_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ error: "ADMIN_DASHBOARD_PASSWORD is not configured" }, { status: 500 });
    }

    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
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
