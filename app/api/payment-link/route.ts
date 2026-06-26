import { isAddress } from "viem";
import { NextResponse } from "next/server";

type PaymentLinkRequest = {
  recipient?: string;
  amount?: string;
  type?: string;
  timeframe?: string;
  memo?: string;
};

function encodePayload(payload: PaymentLinkRequest) {
  return Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as PaymentLinkRequest;

    if (!body.recipient || !isAddress(body.recipient)) {
      return NextResponse.json({ error: "A valid recipient address is required" }, { status: 400 });
    }

    if (!body.amount || Number(body.amount) <= 0) {
      return NextResponse.json({ error: "A positive USDC amount is required" }, { status: 400 });
    }

    const payload = {
      recipient: body.recipient,
      amount: body.amount,
      type: body.type ?? "milestone streaming",
      timeframe: body.timeframe ?? "set in Arc Drift",
      memo: body.memo ?? "",
    };
    const encoded = encodePayload(payload);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://arc-drift.vercel.app";

    return NextResponse.json({
      url: `${baseUrl}/pay/${encoded}`,
      payload,
    });
  } catch (error: unknown) {
    console.error("Payment Link Error:", error);
    return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
  }
}
