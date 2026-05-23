import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from "viem";
import { defineChain } from "viem";
import { NextResponse } from "next/server";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"],
    },
  },
});

export async function POST(req: Request) {
  try {
    const { address } = await req.json() as { address?: string };
    const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? process.env.USDC_ADDRESS;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });
    }

    if (!usdcAddress || !isAddress(usdcAddress)) {
      return NextResponse.json({ error: "USDC contract address is not configured" }, { status: 500 });
    }

    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"),
    });

    const rawBalance = await client.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });

    return NextResponse.json({
      rawBalance: rawBalance.toString(),
      balance: formatUnits(rawBalance, 6),
      symbol: "USDC",
    });
  } catch (error: unknown) {
    console.error("USDC Balance Error:", error);
    return NextResponse.json({ error: "Failed to fetch USDC balance" }, { status: 500 });
  }
}
