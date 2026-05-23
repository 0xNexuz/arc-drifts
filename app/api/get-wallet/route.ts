import { NextResponse } from "next/server";

type CircleWallet = {
  id?: string;
  walletId?: string;
  address?: string;
  blockchain?: string;
};

export async function POST(req: Request) {
  try {
    const { userToken } = await req.json() as { userToken?: string };

    if (!userToken) {
      return NextResponse.json({ error: "userToken is required" }, { status: 400 });
    }

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: "CIRCLE_API_KEY is not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.circle.com/v1/w3s/wallets", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`,
        "X-User-Token": userToken,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error: `Circle wallet lookup failed: ${error}` }, { status: res.status });
    }

    const data = await res.json() as { data?: { wallets?: CircleWallet[] } };
    const wallet = data.data?.wallets?.find((candidate) => (
      candidate.blockchain === "ETH-SEPOLIA" && Boolean(candidate.address)
    ));

    return NextResponse.json({
      address: wallet?.address ?? null,
      walletId: wallet?.id ?? wallet?.walletId ?? null,
      blockchain: wallet?.blockchain ?? null,
    });
  } catch (error: unknown) {
    console.error("Wallet Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 });
  }
}
