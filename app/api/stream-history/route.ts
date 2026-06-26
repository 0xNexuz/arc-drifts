import { isAddress } from "viem";
import { NextResponse } from "next/server";
import { getDriftHistory } from "../../../lib/arcDrift";

export async function POST(req: Request) {
  try {
    const { address } = await req.json() as { address?: string };

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });
    }

    return NextResponse.json(await getDriftHistory(address, 25));
  } catch (error: unknown) {
    console.error("Stream History Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch stream history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
