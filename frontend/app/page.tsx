"use client";
import { useState } from "react";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");

  const connectWallet = async () => {
    // Direct MetaMask call - bypassing the external utility file for speed
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const address = accounts[0];
        setWalletAddress(address.slice(0, 6) + "..." + address.slice(-4));
      } catch (err) {
        console.error("Connection failed", err);
      }
    } else {
      alert("MetaMask not found! Please install it.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Inline Navbar */}
      <nav className="flex justify-between items-center p-6 bg-gray-900 border-b border-gray-800">
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
      
      {/* Main Body */}
      <div className="flex flex-col items-center justify-center mt-24 px-4">
        <h1 className="text-5xl font-bold mb-6 text-center">
          Stream <span className="text-blue-500">Value</span> Seamlessly.
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl text-center mb-10">
          Lock USDC and stream it to your recipients over time. Cancel anytime. No more manual payroll or delayed milestones.
        </p>
        
        {/* Placeholder for the Drift Form */}
        <div className="w-full max-w-md h-64 border border-gray-800 bg-gray-900 rounded-xl flex items-center justify-center text-gray-600 font-mono shadow-2xl">
          [ Form Component Goes Here ]
        </div>
      </div>
    </main>
  );
}