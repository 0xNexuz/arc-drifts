import { network } from "hardhat";
import fs from "fs";

const { ethers } = await network.create();

async function main() {
  console.log("Deploying ArcDriftCore to Arc Testnet...");

  const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || process.env.USDC_ADDRESS;

  if (!USDC_ADDRESS) {
    throw new Error("USDC_ADDRESS or NEXT_PUBLIC_USDC_ADDRESS is required");
  }

  const ArcDriftCore = await ethers.getContractFactory("ArcDriftCore");
  const arcDrift = await ArcDriftCore.deploy(USDC_ADDRESS);

  await arcDrift.waitForDeployment();
  const address = await arcDrift.getAddress();

  console.log(`SUCCESS: ArcDriftCore deployed to ${address}`);

  fs.appendFileSync(
    ".env",
    `\nNEXT_PUBLIC_ARC_DRIFT_CONTRACT_ADDRESS=${address}\nCONTRACT_ADDRESS=${address}\n`,
  );
  console.log("Contract address appended to .env.");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
