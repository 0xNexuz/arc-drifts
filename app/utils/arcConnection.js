import { ethers } from "ethers";
import abi from "../abi.json"; // Adjust this path to wherever you saved abi.json

// Pulling from your .env
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

export const getContract = async () => {
  if (!window.ethereum) {
    throw new Error("No crypto wallet found. Please install MetaMask.");
  }

  // Connect to MetaMask
  await window.ethereum.request({ method: "eth_requestAccounts" });
  
  // Wrap the window.ethereum object with Ethers
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  // Create the contract instance we can actually interact with
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  return { contract, signer, provider };
};