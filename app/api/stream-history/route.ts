import { createPublicClient, formatUnits, http, isAddress, parseAbi } from "viem";
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

const driftAbi = parseAbi([
  "event DriftCreated(uint256 indexed driftId, address indexed sender, address indexed recipient, uint256 amount, uint256 startTime, uint256 endTime, uint256 interval, uint8 ruleType)",
  "event DriftExecuted(uint256 indexed driftId, address indexed recipient, uint256 amount)",
  "event DriftCanceled(uint256 indexed driftId, uint256 refundedAmount)",
  "function drifts(uint256) view returns (address, address, uint256, uint256, uint256, uint256, uint256, uint8, bool)",
]);

const ruleTypes = ["streaming", "delayed", "cancelable", "recurring"] as const;

function getStartBlock() {
  const configuredBlock = process.env.ARC_DRIFT_DEPLOY_BLOCK ?? process.env.NEXT_PUBLIC_ARC_DRIFT_DEPLOY_BLOCK;

  if (!configuredBlock) {
    return 0n;
  }

  try {
    return BigInt(configuredBlock);
  } catch {
    return 0n;
  }
}

export async function POST(req: Request) {
  try {
    const { address } = await req.json() as { address?: string };
    const contractAddress = process.env.NEXT_PUBLIC_ARC_DRIFT_CONTRACT_ADDRESS ?? process.env.CONTRACT_ADDRESS;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });
    }

    if (!contractAddress || !isAddress(contractAddress)) {
      return NextResponse.json({ error: "Arc Drift contract address is not configured" }, { status: 500 });
    }

    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"),
    });

    const [sentLogs, receivedLogs] = await Promise.all([
      client.getLogs({
        address: contractAddress,
        event: driftAbi[0],
        args: { sender: address },
        fromBlock: getStartBlock(),
        toBlock: "latest",
      }),
      client.getLogs({
        address: contractAddress,
        event: driftAbi[0],
        args: { recipient: address },
        fromBlock: getStartBlock(),
        toBlock: "latest",
      }),
    ]);

    const createdLogs = [...sentLogs, ...receivedLogs]
      .filter((log, index, logs) => logs.findIndex((item) => item.transactionHash === log.transactionHash && item.logIndex === log.logIndex) === index)
      .sort((a, b) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n)))
      .slice(0, 25);

    const streams = await Promise.all(createdLogs.map(async (log) => {
      const driftId = log.args.driftId;
      if (driftId === undefined) {
        throw new Error("DriftCreated log is missing driftId");
      }

      const drift = await client.readContract({
        address: contractAddress,
        abi: driftAbi,
        functionName: "drifts",
        args: [driftId],
      });
      const [
        sender,
        recipient,
        amount,
        withdrawn,
        startTime,
        endTime,
        interval,
        ruleType,
        active,
      ] = drift;

      return {
        id: driftId.toString(),
        sender,
        recipient,
        amount: formatUnits(amount, 6),
        amountUnits: amount.toString(),
        withdrawn: formatUnits(withdrawn, 6),
        withdrawnUnits: withdrawn.toString(),
        startTime: Number(startTime),
        endTime: Number(endTime),
        interval: Number(interval),
        ruleType: ruleTypes[ruleType] ?? "streaming",
        active,
        createdTxHash: log.transactionHash,
        createdBlockNumber: log.blockNumber?.toString() ?? null,
      };
    }));

    const now = Math.floor(Date.now() / 1000);
    const activeStream = streams.find((stream) => stream.active && stream.endTime > now)
      ?? streams.find((stream) => stream.active)
      ?? null;

    const transactions = await Promise.all(createdLogs.map(async (log) => {
      const driftId = log.args.driftId;
      if (driftId === undefined) {
        throw new Error("DriftCreated log is missing driftId");
      }

      const [executedLogs, canceledLogs] = await Promise.all([
        client.getLogs({
          address: contractAddress,
          event: driftAbi[1],
          args: { driftId },
          fromBlock: log.blockNumber ?? getStartBlock(),
          toBlock: "latest",
        }),
        client.getLogs({
          address: contractAddress,
          event: driftAbi[2],
          args: { driftId },
          fromBlock: log.blockNumber ?? getStartBlock(),
          toBlock: "latest",
        }),
      ]);

      return [
        {
          label: `Drift #${driftId.toString()} created`,
          hash: log.transactionHash,
          status: "created",
          blockNumber: log.blockNumber?.toString() ?? null,
        },
        ...executedLogs.map((eventLog) => ({
          label: `Drift #${driftId.toString()} executed`,
          hash: eventLog.transactionHash,
          status: "executed",
          blockNumber: eventLog.blockNumber?.toString() ?? null,
        })),
        ...canceledLogs.map((eventLog) => ({
          label: `Drift #${driftId.toString()} canceled`,
          hash: eventLog.transactionHash,
          status: "canceled",
          blockNumber: eventLog.blockNumber?.toString() ?? null,
        })),
      ];
    }));

    return NextResponse.json({
      streams,
      activeStream,
      transactions: transactions
        .flat()
        .filter((transaction, index, all) => all.findIndex((item) => item.hash === transaction.hash && item.label === transaction.label) === index)
        .sort((a, b) => Number(BigInt(b.blockNumber ?? "0") - BigInt(a.blockNumber ?? "0")))
        .slice(0, 12),
    });
  } catch (error: unknown) {
    console.error("Stream History Error:", error);
    return NextResponse.json({ error: "Failed to fetch stream history" }, { status: 500 });
  }
}
