import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import { NextResponse } from "next/server";
import { getContractAddress } from "../../../lib/arcDrift";

type ExecuteDriftRequest = {
  userToken?: string;
  walletId?: string;
  driftId?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to create execute challenge";
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as ExecuteDriftRequest;

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: "CIRCLE_API_KEY is not configured" }, { status: 500 });
    }

    if (!body.userToken || !body.walletId || body.driftId === undefined) {
      return NextResponse.json({ error: "Missing execute transaction fields" }, { status: 400 });
    }

    const driftId = BigInt(body.driftId);
    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    });

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken: body.userToken,
      walletId: body.walletId,
      contractAddress: getContractAddress(),
      abiFunctionSignature: "executeDrift(uint256)",
      abiParameters: [driftId.toString()],
      fee: {
        type: "level",
        config: { feeLevel: "MEDIUM" },
      },
      idempotencyKey: crypto.randomUUID(),
    });

    const challengeId = response.data?.challengeId;

    if (!challengeId) {
      return NextResponse.json({ error: "Circle did not return an execute challenge" }, { status: 502 });
    }

    return NextResponse.json({ challengeId });
  } catch (error: unknown) {
    console.error("Circle Execute Error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
