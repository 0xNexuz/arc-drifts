import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import { isAddress } from "viem";
import { NextResponse } from "next/server";

type FaucetRequest = {
  address?: string;
  usdc?: boolean;
  native?: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to request faucet tokens";
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as FaucetRequest;

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: "CIRCLE_API_KEY is not configured" }, { status: 500 });
    }

    if (!body.address || !isAddress(body.address)) {
      return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    });

    await circleClient.requestTestnetTokens({
      address: body.address,
      blockchain: "ARC-TESTNET",
      usdc: body.usdc ?? true,
      native: body.native ?? false,
    });

    return NextResponse.json({
      ok: true,
      message: "Faucet request submitted for Arc Testnet",
    });
  } catch (error: unknown) {
    console.error("Circle Faucet Error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
