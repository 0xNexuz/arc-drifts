import Image from "next/image";
import Link from "next/link";
import SiteFooter from "../components/SiteFooter";

const envVars = [
  ["CIRCLE_API_KEY", "Server-side Circle API key used by the app routes."],
  ["NEXT_PUBLIC_CIRCLE_APP_ID", "Circle app id used by the PIN challenge SDK."],
  ["NEXT_PUBLIC_ARC_DRIFT_CONTRACT_ADDRESS", "Arc Drift Core contract on Arc Testnet."],
  ["NEXT_PUBLIC_USDC_ADDRESS", "Arc Testnet USDC address."],
  ["ARC_RPC_URL", "Arc Testnet RPC endpoint for reads, balances, and event history."],
  ["ADMIN_DASHBOARD_PASSWORD", "Password gate for the private /admin dashboard."],
  ["NEXT_PUBLIC_APP_URL", "Base URL used when generating public payment links."],
  ["RESEND_API_KEY", "Optional email provider key for outbound V2 notifications."],
  ["NOTIFICATION_FROM_EMAIL", "Optional verified sender address for notification emails."],
  ["PRIVATE_KEY", "Optional deployer key for Hardhat contract deployment."],
];

const apiRoutes = [
  ["POST /api/circle-auth", "Creates or restores a Circle user, then ensures an Arc Testnet SCA wallet exists."],
  ["POST /api/get-wallet", "Polls Circle for the connected wallet address and available blockchains."],
  ["POST /api/usdc-balance", "Reads USDC balance from Arc Testnet for the connected wallet."],
  ["POST /api/approve-usdc-challenge", "Creates the Circle challenge for USDC allowance approval."],
  ["POST /api/create-drift-challenge", "Creates the Circle challenge that calls createDrift on Arc Drift Core."],
  ["POST /api/transaction-proof", "Polls Circle transaction history for tx hash proof after a challenge completes."],
  ["POST /api/stream-history", "Reads Arc Drift contract events and restores stream progress plus tx links."],
  ["POST /api/execute-drift-challenge", "Creates a Circle challenge to claim unlocked stream funds."],
  ["POST /api/cancel-drift-challenge", "Creates a Circle challenge to cancel cancellable escrows."],
  ["POST /api/admin/summary", "Password-protected admin snapshot rebuilt from on-chain events."],
  ["POST /api/payment-link", "Creates a database-free encoded public payment request link."],
  ["POST /api/notifications", "Queues stream lifecycle emails when an email provider is configured."],
];

const flow = [
  ["1", "Email login", "Circle creates or restores the user, then returns a PIN challenge and wallet session."],
  ["2", "Wallet funding", "The app copies the Arc wallet and opens Circle Faucet for Arc Testnet USDC."],
  ["3", "Rule setup", "The user chooses amount, recipient, timing, and transfer type."],
  ["4", "Approval", "Circle signs an approval transaction for the USDC amount."],
  ["5", "Drift creation", "Circle signs the contract call that stores the stream rule on Arc Testnet."],
  ["6", "History recovery", "Reconnect loads contract events so progress and tx links survive refresh or device changes."],
];

const streamTypes = [
  ["Streaming payment", "Linear unlock between start and end time."],
  ["Delayed transfer", "Full amount unlocks only after the deadline."],
  ["Cancellable transfer", "Sender can cancel before the deadline and recover unclaimed funds."],
  ["Recurring payment", "Unlocks in fixed installments based on the interval."],
];

const contractEvents = [
  ["DriftCreated", "Primary event used to restore stream metadata and creation tx hash."],
  ["DriftExecuted", "Shows withdrawal/execution transactions in the history panel."],
  ["DriftCanceled", "Shows cancelled streams and refund transactions."],
];

const v2Surfaces = [
  ["/dashboard", "User stream dashboard", "Wallet owners can view active, completed, cancelled, and recurring streams, then claim or cancel eligible escrows."],
  ["/admin", "Private admin dashboard", "Password-gated operator view for wallets, USDC volume, stream counts, and transaction hashes without a database."],
  ["/pay/[request]", "Public payment links", "Encoded links let clients and creators share a requested recipient, amount, timeframe, and memo."],
  ["/docs", "Docs V2", "Documents routes, contract events, payment links, notification hooks, and the Arc Drift escrow workflow."],
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#EDEDED]">
      <nav className="border-b border-[#EDEDED]/10 bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Arc Drift home">
            <Image src="/arc-drift-logo.svg" alt="" width={32} height={32} priority />
            <span className="text-sm font-semibold uppercase tracking-[0.28em]">Arc Drift</span>
          </Link>
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-[#AFAFAF]">
            <Link href="/" className="transition hover:text-[#ACC6E9]">App</Link>
            <a href="#api" className="transition hover:text-[#ACC6E9]">API</a>
            <a href="#contract" className="transition hover:text-[#ACC6E9]">Contract</a>
          </div>
        </div>
      </nav>

      <section className="border-b border-[#EDEDED]/10 px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">Developer docs</p>
            <h1 className="mt-5 max-w-xl text-6xl font-medium leading-none">
              Build with Arc Drift.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[#CFCFCF]">
              Arc Drift helps freelancers, creators, companies, and agencies run milestone and time-based escrow payments with Circle wallets and Arc Testnet USDC.
              This page maps the app flow, V2 routes, env setup, and recovery behavior.
            </p>
          </div>

          <div className="grid content-start gap-3 rounded-lg border border-[#EDEDED]/12 bg-[#151515] p-4">
            <div className="rounded-lg bg-[#EDEDED] p-5 text-[#050505]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#4A4A4A]">Quick start</p>
              <pre className="mt-5 overflow-x-auto rounded-lg bg-[#050505] p-4 text-sm leading-7 text-[#EDEDED]">
                <code>{`npm install
npm run dev

# deploy contract
npx hardhat run scripts/deploy.js --network arcTestnet`}</code>
              </pre>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/"
                className="grid h-12 place-items-center rounded-lg bg-[#ACC6E9] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#050505] transition hover:bg-[#EDEDED]"
              >
                Open App
              </Link>
              <a
                href="https://arc-drift.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="grid h-12 place-items-center rounded-lg border border-[#EDEDED]/15 px-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#EDEDED] transition hover:border-[#ACC6E9] hover:text-[#ACC6E9]"
              >
                Production
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#EDEDED]/10 px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-px overflow-hidden rounded-lg border border-[#EDEDED]/10 bg-[#EDEDED]/10 md:grid-cols-3">
            {flow.map(([step, title, body]) => (
              <article key={step} className="bg-[#151515] p-6">
                <span className="font-mono text-4xl text-[#ACC6E9]">{step}</span>
                <h2 className="mt-5 text-2xl">{title}</h2>
                <p className="mt-3 leading-7 text-[#AFAFAF]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="env" className="border-b border-[#EDEDED]/10 bg-[#EDEDED] px-5 py-16 text-[#050505] lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#2F578C]">Environment</p>
            <h2 className="mt-5 text-5xl font-medium leading-none">Required config.</h2>
          </div>
          <div className="grid gap-3">
            {envVars.map(([name, body]) => (
              <div key={name} className="grid gap-3 rounded-lg border border-[#050505]/12 p-5 md:grid-cols-[18rem_1fr]">
                <code className="break-all font-mono text-sm font-semibold">{name}</code>
                <p className="leading-7 text-[#292929]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="api" className="border-b border-[#EDEDED]/10 px-5 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">API routes</p>
            <h2 className="mt-5 text-5xl font-medium leading-none">Server endpoints.</h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-[#EDEDED]/10 bg-[#EDEDED]/10">
            {apiRoutes.map(([route, body]) => (
              <div key={route} className="grid gap-3 bg-[#151515] p-5 md:grid-cols-[18rem_1fr]">
                <code className="break-all font-mono text-sm text-[#ACC6E9]">{route}</code>
                <p className="leading-7 text-[#AFAFAF]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#EDEDED]/10 px-5 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">V2 surfaces</p>
            <h2 className="mt-5 text-5xl font-medium leading-none">Added without changing the main app.</h2>
          </div>
          <div className="grid gap-3">
            {v2Surfaces.map(([route, title, body]) => (
              <div key={route} className="grid gap-3 rounded-lg border border-[#EDEDED]/10 bg-[#151515] p-5 md:grid-cols-[12rem_1fr]">
                <code className="font-mono text-sm text-[#ACC6E9]">{route}</code>
                <div>
                  <h3 className="text-xl">{title}</h3>
                  <p className="mt-2 leading-7 text-[#AFAFAF]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contract" className="border-b border-[#EDEDED]/10 px-5 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">Contract</p>
            <h2 className="mt-5 text-5xl font-medium leading-none">Arc Drift Core.</h2>
            <pre className="mt-8 overflow-x-auto rounded-lg border border-[#EDEDED]/10 bg-[#151515] p-5 text-sm leading-7 text-[#EDEDED]">
              <code>{`createDrift(
  address recipient,
  uint256 amount,
  uint256 startTime,
  uint256 endTime,
  uint256 interval,
  RuleType ruleType
)`}</code>
            </pre>
          </div>
          <div className="grid content-start gap-3">
            {contractEvents.map(([name, body]) => (
              <div key={name} className="rounded-lg border border-[#EDEDED]/10 bg-[#151515] p-5">
                <code className="font-mono text-sm text-[#ACC6E9]">{name}</code>
                <p className="mt-3 leading-7 text-[#AFAFAF]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">Stream rules</p>
            <h2 className="mt-5 text-5xl font-medium leading-none">Supported transfers.</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {streamTypes.map(([name, body]) => (
              <div key={name} className="rounded-lg border border-[#EDEDED]/10 bg-[#151515] p-5">
                <h3 className="text-xl">{name}</h3>
                <p className="mt-3 leading-7 text-[#AFAFAF]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
