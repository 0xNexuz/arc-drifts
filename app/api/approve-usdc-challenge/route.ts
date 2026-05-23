import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import { isAddress } from "viem";
import { NextResponse } from "next/server";

type ApproveRequest = {
  userToken?: string;
  walletId?: string;
  amount?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to create approval challenge";
}

export async function POST(req: Request) {
  try {
    const { userToken, walletId, amount } = await req.json() as ApproveRequest;
    const contractAddress = process.env.NEXT_PUBLIC_ARC_DRIFT_CONTRACT_ADDRESS ?? process.env.CONTRACT_ADDRESS;
    const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? process.env.USDC_ADDRESS;

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: "CIRCLE_API_KEY is not configured" }, { status: 500 });
    }

    if (!userToken || !walletId || !amount) {
      return NextResponse.json({ error: "userToken, walletId, and amount are required" }, { status: 400 });
    }

    if (!contractAddress || !isAddress(contractAddress)) {
      return NextResponse.json({ error: "Arc Drift contract address is not configured" }, { status: 500 });
    }

    if (!usdcAddress || !isAddress(usdcAddress)) {
      return NextResponse.json({ error: "USDC contract address is not configured" }, { status: 500 });
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    });

    const response = await circleClient.createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: usdcAddress,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [contractAddress, amount],
      fee: {
        type: "level",
        config: { feeLevel: "MEDIUM" },
      },
      idempotencyKey: crypto.randomUUID(),
    });

    const challengeId = response.data?.challengeId;

    if (!challengeId) {
      return NextResponse.json({ error: "Circle did not return an approval challenge" }, { status: 502 });
    }

    return NextResponse.json({ challengeId });
  } catch (error: unknown) {
    console.error("Circle Approval Error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
