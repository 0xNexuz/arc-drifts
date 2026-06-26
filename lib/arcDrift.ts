import { createPublicClient, formatUnits, http, isAddress, parseAbi, type Address } from "viem";
import { defineChain } from "viem";

export const ARC_EXPLORER = "https://testnet.arcscan.app";

export const arcTestnet = defineChain({
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

export const driftAbi = parseAbi([
  "event DriftCreated(uint256 indexed driftId, address indexed sender, address indexed recipient, uint256 amount, uint256 startTime, uint256 endTime, uint256 interval, uint8 ruleType)",
  "event DriftExecuted(uint256 indexed driftId, address indexed recipient, uint256 amount)",
  "event DriftCanceled(uint256 indexed driftId, uint256 refundedAmount)",
  "function drifts(uint256) view returns (address, address, uint256, uint256, uint256, uint256, uint256, uint8, bool)",
  "function executeDrift(uint256)",
  "function cancelDrift(uint256)",
  "function releasable(uint256) view returns (uint256)",
]);

export const ruleTypes = ["streaming", "delayed", "cancelable", "recurring"] as const;
export type StreamType = (typeof ruleTypes)[number];

export type StreamHistoryStream = {
  id: string;
  sender: Address;
  recipient: Address;
  amount: string;
  amountUnits: string;
  withdrawn: string;
  withdrawnUnits: string;
  releasable: string;
  releasableUnits: string;
  startTime: number;
  endTime: number;
  interval: number;
  ruleType: StreamType;
  active: boolean;
  createdTxHash: string;
  createdBlockNumber: string | null;
};

export type StreamHistoryTransaction = {
  label: string;
  hash: string;
  status: "created" | "executed" | "canceled";
  blockNumber: string | null;
};

export type StreamHistoryResult = {
  streams: StreamHistoryStream[];
  activeStream: StreamHistoryStream | null;
  transactions: StreamHistoryTransaction[];
};

export function getContractAddress(): Address {
  const contractAddress = process.env.NEXT_PUBLIC_ARC_DRIFT_CONTRACT_ADDRESS ?? process.env.CONTRACT_ADDRESS;

  if (!contractAddress || !isAddress(contractAddress)) {
    throw new Error("Arc Drift contract address is not configured");
  }

  return contractAddress;
}

export function getPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"),
  });
}

export function getStartBlock() {
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

export async function getDriftHistory(address?: string, limit = 50): Promise<StreamHistoryResult> {
  if (address && !isAddress(address)) {
    throw new Error("A valid wallet address is required");
  }

  const client = getPublicClient();
  const contractAddress = getContractAddress();
  const fromBlock = getStartBlock();
  const walletAddress = address as Address | undefined;

  const createdLogs = address
    ? [
        ...await client.getLogs({
          address: contractAddress,
          event: driftAbi[0],
          args: { sender: walletAddress },
          fromBlock,
          toBlock: "latest",
        }),
        ...await client.getLogs({
          address: contractAddress,
          event: driftAbi[0],
          args: { recipient: walletAddress },
          fromBlock,
          toBlock: "latest",
        }),
      ]
    : await client.getLogs({
        address: contractAddress,
        event: driftAbi[0],
        fromBlock,
        toBlock: "latest",
      });

  const uniqueCreatedLogs = createdLogs
    .filter((log, index, logs) => logs.findIndex((item) => item.transactionHash === log.transactionHash && item.logIndex === log.logIndex) === index)
    .sort((a, b) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n)))
    .slice(0, limit);

  const streams = await Promise.all(uniqueCreatedLogs.map(async (log) => {
    const driftId = log.args.driftId;
    if (driftId === undefined) {
      throw new Error("DriftCreated log is missing driftId");
    }

    const [drift, rawReleasable] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: driftAbi,
        functionName: "drifts",
        args: [driftId],
      }),
      client.readContract({
        address: contractAddress,
        abi: driftAbi,
        functionName: "releasable",
        args: [driftId],
      }),
    ]);
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
      releasable: formatUnits(rawReleasable, 6),
      releasableUnits: rawReleasable.toString(),
      startTime: Number(startTime),
      endTime: Number(endTime),
      interval: Number(interval),
      ruleType: ruleTypes[ruleType] ?? "streaming",
      active,
      createdTxHash: log.transactionHash,
      createdBlockNumber: log.blockNumber?.toString() ?? null,
    };
  }));

  const transactions = await Promise.all(uniqueCreatedLogs.map(async (log) => {
    const driftId = log.args.driftId;
    if (driftId === undefined) {
      throw new Error("DriftCreated log is missing driftId");
    }

    const [executedLogs, canceledLogs] = await Promise.all([
      client.getLogs({
        address: contractAddress,
        event: driftAbi[1],
        args: { driftId },
        fromBlock: log.blockNumber ?? fromBlock,
        toBlock: "latest",
      }),
      client.getLogs({
        address: contractAddress,
        event: driftAbi[2],
        args: { driftId },
        fromBlock: log.blockNumber ?? fromBlock,
        toBlock: "latest",
      }),
    ]);

    return [
      {
        label: `Drift #${driftId.toString()} created`,
        hash: log.transactionHash,
        status: "created" as const,
        blockNumber: log.blockNumber?.toString() ?? null,
      },
      ...executedLogs.map((eventLog) => ({
        label: `Drift #${driftId.toString()} executed`,
        hash: eventLog.transactionHash,
        status: "executed" as const,
        blockNumber: eventLog.blockNumber?.toString() ?? null,
      })),
      ...canceledLogs.map((eventLog) => ({
        label: `Drift #${driftId.toString()} canceled`,
        hash: eventLog.transactionHash,
        status: "canceled" as const,
        blockNumber: eventLog.blockNumber?.toString() ?? null,
      })),
    ];
  }));

  const now = Math.floor(Date.now() / 1000);
  const activeStream = streams.find((stream) => stream.active && stream.endTime > now)
    ?? streams.find((stream) => stream.active)
    ?? null;

  return {
    streams,
    activeStream,
    transactions: transactions
      .flat()
      .filter((transaction, index, all) => all.findIndex((item) => item.hash === transaction.hash && item.label === transaction.label) === index)
      .sort((a, b) => Number(BigInt(b.blockNumber ?? "0") - BigInt(a.blockNumber ?? "0")))
      .slice(0, limit),
  };
}
