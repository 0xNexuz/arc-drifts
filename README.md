# Arc Drift 🌊
**Decentralized Escrow & Continuous Streaming Protocol on the ARC Network**

Arc Drift is an on-chain, non-custodial payment protocol that allows users to send delayed, continuous, and cancelable micro-payments using USDC. Built for the ARC Testnet, it features a smart contract vault and an automated off-chain Keeper Bot network that executes transactions on behalf of recipients—enabling a true zero-gas claiming experience.

![ArcLens Approved](https://img.shields.io/badge/ArcLens-Listed_&_Approved-3B82F6?style=for-the-badge)
![Network](https://img.shields.io/badge/Network-ARC_Testnet-7B5EFA?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Live-success?style=for-the-badge)

---

## 📖 Overview

Standard blockchain transactions are instantaneous and final. Arc Drift introduces **programmable time** into token transfers. 

When a user initializes a Drift, their USDC is locked in the `ArcDriftCore` smart contract. The funds are then distributed according to the chosen mathematical rule (e.g., linear streaming per second, or a cliff-unlock after a delay). 

To solve the UX friction of requiring recipients to pay gas to "claim" their funds, Arc Drift utilizes a Node.js Keeper Bot. This bot monitors the blockchain and automatically covers the ARC gas fee to execute mature Drifts, dropping the USDC directly into the recipient's wallet seamlessly.

---

## ✨ Core Features

* **Continuous Streaming (🌊):** USDC unlocks linearly every second. Pay employees or contractors in real-time.
* **Delayed Transfers (🕒):** Funds are locked in the vault and unlock 100% only when the deadline expires.
* **Cancelable Escrow (🚫):** Senders can revoke unstreamed funds before the duration is complete, perfect for milestone-based bounties.
* **Gasless Receiving (🤖):** Recipients do not need ARC tokens to receive their USDC. The Keeper Bot network auto-settles the contracts.

---

## 🏗️ System Architecture

### High-Level Flow
```mermaid
graph TD
    Sender[👤 Sender] -->|1. Configures Payment| UI(🖥️ Arc Drift UI)
    UI -->|2. Approves USDC| USDC[🪙 Official Testnet USDC]
    UI -->|3. createDrift| Contract{📜 ArcDriftCore Contract}
    
    Contract ---|Locks Funds| Vault[(On-Chain Vault)]
    
    Bot[🤖 Off-Chain Keeper Bot] -->|4. Monitors timestamp| Contract
    Bot -->|5. executeDrift pays gas| Contract
    
    Contract -->|6. Auto-Transfers| Recipient[👤 Recipient]
    
    classDef contract fill:#1E293B,stroke:#7B5EFA,stroke-width:2px,color:#fff,stroke-dasharray: 5 5;
    classDef user fill:#0F172A,stroke:#3B82F6,stroke-width:2px,color:#fff;
    classDef bot fill:#052E16,stroke:#22C55E,stroke-width:2px,color:#fff;
    
    class Sender,Recipient user;
    class Contract contract;
    class Bot bot; 
```

```mermaid
sequenceDiagram
    participant U as 👤 Sender
    participant SC as 📜 ArcDriftCore (Vault)
    participant Bot as 🤖 Keeper Bot
    participant R as 👤 Recipient

    U->>SC: 1. createDrift(recipient, 5 USDC, 1 Hour)
    Note over SC: 🔒 Vault Locked
    Note over SC, Bot: ⏳ 1 Hour Passes...
    loop Every Block
        Bot->>SC: Check block.timestamp
    end
    Note over Bot: Timer Expired!
    Bot->>SC: 2. executeDrift(driftId)
    Note right of Bot: Bot pays the ARC gas fee
    Note over SC: Vault Unlocked 🔓
    SC-->>R: 3. Transfer 5 USDC
    Note right of R: Recipient gets funds (Zero Gas)
```

