require('dotenv').config();
const { ethers } = require('ethers');

// 1. Setup the Network Connection
const RPC_URL = process.env.ARC_RPC_URL || "https://rpc-testnet.arc.xyz"; // ARC Testnet
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const CONTRACT_ADDRESS = "0xca023e888478c8ADa406b2dfAffC171dA3d0Ab73"; // Put your contract address here

if (!PRIVATE_KEY) {
    console.error("❌ No private key found in .env file!");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// 2. The exact function we need to call to push the money
const ABI = [
    "function executeDrift(uint256 _id) external"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

async function runKeeper() {
    console.log("=========================================");
    console.log("🤖 ARC Drift Keeper Bot Online");
    console.log(`📡 Connected as: ${wallet.address}`);
    console.log("=========================================\n");

    // For the hackathon, we simulate passing in a Drift ID (e.g., ID 0)
    // In a massive production app, we would query the blockchain for ALL active drifts.
    const driftIdToExecute = 0; 

    console.log(`🔍 Checking constraints for Drift ID: ${driftIdToExecute}...`);

    try {
        console.log(`⚡ Firing execution transaction...`);
        const tx = await contract.executeDrift(driftIdToExecute);
        
        console.log(`⏳ Waiting for block confirmation... (Tx: ${tx.hash})`);
        await tx.wait();

        console.log(`✅ Drift executed successfully! Funds released.`);
    } catch (error) {
        console.error(`❌ Execution Failed. Drift might not be ready yet, or already closed.`);
        console.error(`Reason: ${error.reason || error.message}`);
    }
}

// Execute the bot
runKeeper();