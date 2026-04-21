import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "dotenv/config";

export default defineConfig({
  // THIS is the new Hardhat 3 way to load plugins!
  plugins: [hardhatToolboxMochaEthers], 
  solidity: "0.8.28",
  networks: {
    arcTestnet: {
      type: "http", 
      url: process.env.ARC_RPC_URL || "https://rpc-testnet.arc.xyz",
      chainId: 5042002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] 
    }
  }
});