import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import { isAddress } from "viem";
import { NextResponse } from "next/server";

const BLOCKCHAIN = "ARC-TESTNET";

type TransactionProofRequest = {
  userToken?: string;
  walletId?: string;
  contractAddress?: string;
  createdAfter?: string;
};

type CircleTransaction = {
  id?: string;
  txHash?: string;
  state?: string;
  transactionType?: string;
  operation?: string;
  contractAddress?: string;
  createDate?: string;
};

function matchesContract(transaction: CircleTransaction, contractAddress?: string) {
  if (!contractAddress) {
    return true;
  }

  return transaction.contractAddress?.toLowerCase() === contractAddress.toLowerCase();
}

function isAfter(transaction: CircleTransaction, createdAfter?: string) {
  if (!createdAfter || !transaction.createDate) {
    return true;
  }

  return new Date(transaction.createDate).getTime() >= new Date(createdAfter).getTime() - 10_000;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as TransactionProofRequest;

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: "CIRCLE_API_KEY is not configured" }, { status: 500 });
    }

    if (!body.userToken || !body.walletId) {
      return NextResponse.json({ error: "userToken and walletId are required" }, { status: 400 });
    }

    if (body.contractAddress && !isAddress(body.contractAddress)) {
      return NextResponse.json({ error: "contractAddress is invalid" }, { status: 400 });
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    });

    const response = await circleClient.listTransactions({
      userToken: body.userToken,
      blockchain: BLOCKCHAIN,
      operation: "CONTRACT_EXECUTION",
      walletIds: [body.walletId],
      pageSize: 10,
      order: "DESC",
    });

    const transactions = (response.data?.transactions ?? []) as CircleTransaction[];
    const transaction = transactions.find((candidate) => (
      matchesContract(candidate, body.contractAddress) &&
      isAfter(candidate, body.createdAfter) &&
      Boolean(candidate.txHash)
    )) ?? transactions.find((candidate) => (
      matchesContract(candidate, body.contractAddress) &&
      isAfter(candidate, body.createdAfter)
    ));

    return NextResponse.json({
      transactionId: transaction?.id ?? null,
      txHash: transaction?.txHash ?? null,
      state: transaction?.state ?? null,
      transactionType: transaction?.transactionType ?? null,
      operation: transaction?.operation ?? null,
      contractAddress: transaction?.contractAddress ?? null,
    });
  } catch (error: unknown) {
    console.error("Circle Transaction Proof Error:", error);
    return NextResponse.json({ error: "Failed to fetch transaction proof" }, { status: 500 });
  }
}
