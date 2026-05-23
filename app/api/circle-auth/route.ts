import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import { NextResponse } from "next/server";

const BLOCKCHAIN = "ARC-TESTNET";
const ACCOUNT_TYPE = "SCA";

type CircleWallet = {
  id?: string;
  address?: string;
  blockchain?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to authenticate";
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!process.env.CIRCLE_API_KEY) {
      return NextResponse.json({ error: "CIRCLE_API_KEY is not configured" }, { status: 500 });
    }

    const circleClient = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
    });

    let userToken: string | undefined;
    let encryptionKey: string | undefined;
    let createdUser = false;

    try {
      const response = await circleClient.createUserToken({ userId: email });
      userToken = response.data?.userToken;
      encryptionKey = response.data?.encryptionKey;
    } catch {
      console.log(`Creating new Circle wallet identity for ${email}...`);
      await circleClient.createUser({ userId: email });
      createdUser = true;
      const response = await circleClient.createUserToken({ userId: email });
      userToken = response.data?.userToken;
      encryptionKey = response.data?.encryptionKey;
    }

    if (!userToken || !encryptionKey) {
      return NextResponse.json({ error: "Circle did not return authentication data" }, { status: 502 });
    }

    const walletsResponse = await circleClient.listWallets({
      userToken,
      blockchain: BLOCKCHAIN,
    });
    const wallet = walletsResponse.data?.wallets?.find((candidate: CircleWallet) => (
      candidate.blockchain === BLOCKCHAIN && Boolean(candidate.address)
    ));

    if (wallet?.address) {
      return NextResponse.json({
        userToken,
        encryptionKey,
        wallet: {
          id: wallet.id,
          address: wallet.address,
          blockchain: wallet.blockchain,
        },
      });
    }

    const createWalletResponse = createdUser
      ? await circleClient.createUserPinWithWallets({
          userToken,
          idempotencyKey: crypto.randomUUID(),
          blockchains: [BLOCKCHAIN],
          accountType: ACCOUNT_TYPE,
        })
      : await circleClient.createWallet({
          userToken,
          idempotencyKey: crypto.randomUUID(),
          blockchains: [BLOCKCHAIN],
          accountType: ACCOUNT_TYPE,
        });

    return NextResponse.json({
      userToken,
      encryptionKey,
      challengeId: createWalletResponse.data?.challengeId,
      challengeType: createdUser ? "SET_PIN_AND_CREATE_WALLET" : "CREATE_WALLET",
    });
  } catch (error: unknown) {
    console.error("Circle Auth Error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
