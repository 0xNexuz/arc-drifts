import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  console.log("🚢 Deploying ArcDriftCore to ARC Testnet...");

  // Dummy USDC address for the hackathon MVP
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x1111111111111111111111111111111111111111"; 

  // Because we imported ethers directly at the top, this will now work perfectly!
  const ArcDriftCore = await ethers.getContractFactory("ArcDriftCore");
  
  // Deploy the contract
  const arcDrift = await ArcDriftCore.deploy(USDC_ADDRESS);

  // Wait for the blockchain to confirm it
  await arcDrift.waitForDeployment();
  const address = await arcDrift.getAddress();
  
  console.log(`✅ SUCCESS! ArcDriftCore deployed to: ${address}`);

  // Auto-inject the new address into our .env file 
  fs.appendFileSync(".env", `\nNEXT_PUBLIC_CONTRACT_ADDRESS=${address}\nCONTRACT_ADDRESS=${address}\n`);
  console.log("📝 Contract address automatically injected into .env!");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});