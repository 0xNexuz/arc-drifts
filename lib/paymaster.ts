import { encodeFunctionData, type Address } from "viem";

const ARC_DRIFT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_recipient", type: "address" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
      { internalType: "uint256", name: "_startTime", type: "uint256" },
      { internalType: "uint256", name: "_endTime", type: "uint256" },
      { internalType: "uint256", name: "_interval", type: "uint256" },
      { internalType: "uint8", name: "_ruleType", type: "uint8" },
    ],
    name: "createDrift",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function encodeCreateDriftCall(
  recipient: Address,
  amount: bigint,
  startTime: bigint,
  endTime: bigint,
  interval: bigint,
  ruleType: number,
) {
  return encodeFunctionData({
    abi: ARC_DRIFT_ABI,
    functionName: "createDrift",
    args: [recipient, amount, startTime, endTime, interval, ruleType],
  });
}
