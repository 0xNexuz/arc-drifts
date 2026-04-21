"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [activeDrift, setActiveDrift] = useState("streaming");
  
  // Advanced Deploy State
  const [deployStep, setDeployStep] = useState(0); // 0: Idle, 1: Approving, 2: Broadcasting, 3: Success
  const [lastTxHash, setLastTxHash] = useState("");
  
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("arc_drifts");
    if (saved) setActiveStreams(JSON.parse(saved));
  }, []);

  // ⚠️ YOUR ACTUAL ADDRESSES ⚠️
  const CONTRACT_ADDRESS = "0xca023e888478c8ADa406b2dfAffC171dA3d0Ab73"; 
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000"; 

  const MINIMAL_ABI = [
    "function createDrift(address _recipient, uint256 _amount, uint256 _startTime, uint256 _endTime, uint8 _ruleType) external returns (uint256)"
  ];
  
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)"
  ];

  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        setWalletAddress(accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4));
      } catch (err) {
        console.error("Connection failed", err);
      }
    } else {
      alert("MetaMask not found!");
    }
  };

  const saveStream = (newStream: any) => {
    const updated = [newStream, ...activeStreams];
    setActiveStreams(updated);
    localStorage.setItem("arc_drifts", JSON.stringify(updated));
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) return alert("Connect your wallet first!");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      
      // Fixed 6 decimals for official USDC!
      const parsedAmount = ethers.parseUnits(amount, 6);

      // --- STEP 1: APPROVE ---
      setDeployStep(1);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const approveTx = await usdcContract.approve(CONTRACT_ADDRESS, parsedAmount);
      await approveTx.wait();

      // --- STEP 2: BROADCAST ---
      setDeployStep(2);
      const driftContract = new ethers.Contract(CONTRACT_ADDRESS, MINIMAL_ABI, signer);
      const startTime = Math.floor(Date.now() / 1000); 
      const durationInSeconds = Number(duration) * 3600; 
      const endTime = startTime + durationInSeconds;
      let ruleTypeEnum = activeDrift === "delayed" ? 1 : activeDrift === "cancelable" ? 2 : 0;

      const tx = await driftContract.createDrift(recipient, parsedAmount, startTime, endTime, ruleTypeEnum);
      await tx.wait();

      // --- STEP 3: SUCCESS ---
      setDeployStep(3);
      setLastTxHash(tx.hash);
      
      const newStream = {
        id: tx.hash.substring(0, 8),
        type: activeDrift,
        recipient: recipient.slice(0, 6) + "..." + recipient.slice(-4),
        amount: amount,
        timeRemaining: duration + " hrs",
        status: "Active 🟢"
      };
      
      saveStream(newStream);
      setRecipient(""); setAmount(""); setDuration("");

      // Reset UI after 6 seconds
      setTimeout(() => { setDeployStep(0); setLastTxHash(""); }, 6000);

    } catch (err: any) {
      console.error(err);
      alert(`Transaction Failed: ${err.reason || err.message}`);
      setDeployStep(0);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#111827] via-[#07090E] to-[#000000] text-white font-sans selection:bg-blue-500/30 pb-20">
      
      {/* PERFECTED CSS-ONLY NAVBAR */}
      <nav className="flex justify-between items-center p-4 md:p-6 mb-4 md:mb-8 backdrop-blur-md bg-black/20 border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-[#7B5EFA] to-[#3B82F6] flex items-center justify-center shadow-[0_0_20px_rgba(123,94,250,0.4)]">
            <div className="w-3 h-4 md:w-4 md:h-5 border-2 border-white rounded-t-full border-b-0 mt-1"></div>
          </div>
          <div className="text-xl md:text-2xl font-bold tracking-tight">
            ARC <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-gray-600 font-medium">Drift</span>
          </div>
        </div>
        <button onClick={connectWallet} className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 px-4 py-2 md:px-6 md:py-2.5 rounded-xl font-semibold shadow-lg backdrop-blur-sm transition-all text-xs md:text-sm">
          {walletAddress ? <span className="text-green-400 tracking-wider font-mono">{walletAddress}</span> : "Connect Wallet"}
        </button>
      </nav>
      
      <div className="flex flex-col items-center px-4">
        {/* The Glass Card Form */}
        <div className="w-full max-w-[550px] bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden mb-12">
          
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#7B5EFA] rounded-full blur-[100px] opacity-20"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#3B82F6] rounded-full blur-[100px] opacity-20"></div>

          <div className="flex items-center gap-3 md:gap-4 mb-8 relative z-10">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-[#1C2333] to-[#0E121A] border border-white/5 flex items-center justify-center text-blue-400 font-light text-2xl md:text-3xl shadow-inner">+</div>
            <h2 className="text-xl md:text-2xl font-bold tracking-wide">Deploy Drift</h2>
            <span className="ml-auto px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-[9px] md:text-[10px] font-bold text-blue-400 tracking-widest uppercase">
              Mainnet Ready
            </span>
          </div>

          {/* Grid Selection */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8 relative z-10">
            <DriftCard id="delayed" title="Delayed Transfer" icon="🕒" isActive={activeDrift === "delayed"} onClick={() => setActiveDrift("delayed")} />
            <DriftCard id="streaming" title="Streaming Payment" icon="🌊" isActive={activeDrift === "streaming"} onClick={() => setActiveDrift("streaming")} />
            <DriftCard id="cancelable" title="Cancelable Transfer" icon="🚫" isActive={activeDrift === "cancelable"} onClick={() => setActiveDrift("cancelable")} />
            <DriftCard id="recurring" title="Recurring Payment" icon="🔁" isActive={activeDrift === "recurring"} onClick={() => setActiveDrift("recurring")} />
          </div>

          <form onSubmit={handleDeploy} className="flex flex-col gap-5 md:gap-6 relative z-10">
            <div>
              <label className="block text-[#64748B] text-[10px] md:text-xs font-bold mb-2 tracking-widest uppercase">Recipient Address</label>
              <input type="text" placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full bg-black/40 border border-white/10 text-gray-200 p-3.5 md:p-4 rounded-xl focus:outline-none focus:border-[#7B5EFA] focus:ring-1 focus:ring-[#7B5EFA] transition-all font-mono text-xs md:text-sm shadow-inner" required />
            </div>
            
            <div className="flex flex-col md:flex-row gap-5 md:gap-4">
              <div className="w-full md:w-1/2">
                <label className="block text-[#64748B] text-[10px] md:text-xs font-bold mb-2 tracking-widest uppercase">Amount (USDC)</label>
                <input type="number" step="any" placeholder="10.5" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-black/40 border border-white/10 text-gray-200 p-3.5 md:p-4 rounded-xl focus:outline-none focus:border-[#7B5EFA] focus:ring-1 focus:ring-[#7B5EFA] transition-all font-mono text-xs md:text-sm shadow-inner" required />
              </div>
              <div className="w-full md:w-1/2">
                <label className="block text-[#64748B] text-[10px] md:text-xs font-bold mb-2 tracking-widest uppercase">Duration (HRS)</label>
                <input type="number" step="any" placeholder="24" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-black/40 border border-white/10 text-gray-200 p-3.5 md:p-4 rounded-xl focus:outline-none focus:border-[#7B5EFA] focus:ring-1 focus:ring-[#7B5EFA] transition-all font-mono text-xs md:text-sm shadow-inner" required />
              </div>
            </div>

            {/* DYNAMIC PROGRESS ENGINE */}
            {deployStep === 0 ? (
              <button type="submit" className="w-full bg-gradient-to-r from-[#7B5EFA] to-[#3B82F6] hover:from-[#684be3] hover:to-[#2563eb] text-white font-bold py-4 rounded-xl mt-2 transition-all text-base md:text-lg shadow-[0_0_30px_rgba(123,94,250,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]">
                Initialize Drift
              </button>
            ) : (
              <div className="w-full bg-black/50 border border-white/10 rounded-xl p-4 md:p-5 mt-2 backdrop-blur-md">
                <div className="flex justify-between text-[10px] md:text-xs font-bold mb-3 uppercase tracking-widest text-gray-400">
                  <span className={deployStep === 3 ? "text-green-400" : "text-blue-400"}>
                    {deployStep === 1 ? "1. Approving USDC..." : deployStep === 2 ? "2. Broadcasting Protocol..." : "Transaction Confirmed!"}
                  </span>
                  <span>{deployStep === 1 ? "33%" : deployStep === 2 ? "66%" : "100%"}</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2 mb-3 border border-white/5 overflow-hidden">
                  <div className={`h-2 rounded-full transition-all duration-500 ease-out ${deployStep === 1 ? 'w-1/3 bg-blue-500' : deployStep === 2 ? 'w-2/3 bg-[#7B5EFA] animate-pulse' : 'w-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`}></div>
                </div>
                {deployStep === 3 && lastTxHash && (
                  <div className="mt-4 pt-4 border-t border-white/5 text-center flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-2">
                    {/* Make sure this Explorer URL matches the official ARC testnet URL */}
                    <a href={`https://testnet.arc.xyz/tx/${lastTxHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-green-400 text-[10px] md:text-xs tracking-widest font-mono transition-all">
                      ↗ VIEW ON EXPLORER
                    </a>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* ACTIVE DRIFTS DASHBOARD */}
        <div className="w-full max-w-[800px] mt-2 md:mt-8 px-2 md:px-0">
          <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
             <h3 className="text-lg md:text-xl font-bold tracking-wide">Protocol Registry</h3>
             <span className="text-xs text-gray-500 font-mono">Live Sync</span>
          </div>
          
          {activeStreams.length === 0 ? (
            <div className="text-center py-12 md:py-16 text-[#64748B] border border-dashed border-white/10 rounded-2xl bg-white/[0.01] backdrop-blur-sm">
              <div className="text-3xl mb-2 opacity-50">🌊</div>
              <div className="text-sm tracking-wide">No active streams detected.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 md:gap-4">
              {activeStreams.map((stream) => (
                <div key={stream.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white/[0.02] backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors shadow-lg">
                  <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="bg-gradient-to-br from-gray-800 to-black w-12 h-12 rounded-xl flex items-center justify-center text-xl border border-white/10 shadow-inner">
                      {stream.type === 'streaming' ? '🌊' : stream.type === 'delayed' ? '🕒' : stream.type === 'cancelable' ? '🚫' : '🔁'}
                    </div>
                    <div>
                      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Recipient</div>
                      <div className="font-mono text-blue-400 text-sm">{stream.recipient}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 md:flex md:items-center md:gap-12 w-full md:w-auto text-left md:text-right">
                    <div>
                      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Amount</div>
                      <div className="font-bold text-white text-sm">{stream.amount} USDC</div>
                    </div>
                    <div>
                      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Duration</div>
                      <div className="font-mono text-gray-300 text-sm">{stream.timeRemaining}</div>
                    </div>
                    <div>
                      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Status</div>
                      <div className="text-green-400 text-xs font-bold uppercase flex items-center md:justify-end gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        {stream.status.replace(' 🟢', '')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function DriftCard({ id, title, icon, isActive, onClick }: any) {
  return (
    <div onClick={onClick} className={`cursor-pointer p-4 md:p-5 rounded-2xl border transition-all duration-300 flex flex-col h-28 md:h-32 justify-end relative overflow-hidden ${isActive ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-[1.02]' : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/[0.02]'}`}>
      <div className={`absolute top-3 md:top-4 left-3 md:left-4 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-base md:text-lg transition-colors ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500'}`}>{icon}</div>
      <h3 className={`font-bold text-xs md:text-sm tracking-wide ${isActive ? 'text-white' : 'text-gray-400'}`}>{title.split(' ').map((word: string, i: number) => <div key={i}>{word}</div>)}</h3>
    </div>
  );
}