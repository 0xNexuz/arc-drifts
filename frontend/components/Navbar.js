"use client";
import { useState } from "react";
import { getContract } from "../utils/arcConnection";

export default function Navbar() {
  const [walletAddress, setWalletAddress] = useState("");

  const connectWallet = async () => {
    try {
      // This triggers MetaMask to open using the utility file you just built
      const { signer } = await getContract();
      const address = await signer.getAddress();
      
      // Format the address so it looks clean (e.g., 0x1234...abcd)
      setWalletAddress(address.slice(0, 6) + "..." + address.slice(-4));
    } catch (error) {
      console.error("Wallet connection failed:", error);
      alert("Failed to connect wallet. Make sure MetaMask is unlocked!");
    }
  };

  return (
    <nav className="flex justify-between items-center p-6 bg-gray-900 text-white border-b border-gray-800">
      <div className="text-2xl font-black tracking-tighter text-blue-500">
        ARC<span className="text-white">DRIFT</span>
      </div>
      <button
        onClick={connectWallet}
        className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-md font-bold transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)]"
      >
        {walletAddress ? walletAddress : "Connect Wallet"}
      </button>
    </nav>
  );
}