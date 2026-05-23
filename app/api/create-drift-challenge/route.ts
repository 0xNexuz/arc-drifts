import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import { isAddress } from "viem";
import { NextResponse } from "next/server";

type CreateDriftRequest = {
  userToken?: string;
  walletId?: string;
  recipient?: string;
  amount?: string;
  startTime?: number;
  endTime?: number;
  ruleType?: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to create drift challenge";
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as CreateDriftRequest;
    const contractAddress = process.env.NEXT_PUBLIC_ARC_DRIFT_CONTRACT_ADDRESS ?? process.env.CONTRACT_ADDRESS;

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: "CIRCLE_API_KEY is not configured" }, { status: 500 });
    }

    if (!body.userToken || !body.walletId || !body.recipient || !body.amount || body.startTime === undefined || body.endTime === undefined || body.ruleType === undefined) {
      return NextResponse.json({ error: "Missing drift transaction fields" }, { status: 400 });
    }

    if (!contractAddress || !isAddress(contractAddress)) {
      return NextResponse.json({ error: "Arc Drift contract address is not configured" }, { status: 500 });
    }

    if (!isAddress(body.recipient)) {
      return NextResponse.json({ error: "Recipient address is invalid" }, { status: 400 });
    }

    if (!Number.isInteger(body.startTime) || !Number.isInteger(body.endTime) || body.endTime <= body.startTime) {
      return NextResponse.json({ error: "Invalid stream timeframe" }, { status: 400 });
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    });

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken: body.userToken,
      walletId: body.walletId,
      contractAddress,
      abiFunctionSignature: "createDrift(address,uint256,uint256,uint256,uint8)",
      abiParameters: [
        body.recipient,
        body.amount,
        body.startTime.toString(),
        body.endTime.toString(),
        body.ruleType.toString(),
      ],
      fee: {
        type: "level",
        config: { feeLevel: "MEDIUM" },
      },
      idempotencyKey: crypto.randomUUID(),
    });

    const challengeId = response.data?.challengeId;

    if (!challengeId) {
      return NextResponse.json({ error: "Circle did not return a drift challenge" }, { status: 502 });
    }

    return NextResponse.json({ challengeId });
  } catch (error: unknown) {
    console.error("Circle Drift Error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
