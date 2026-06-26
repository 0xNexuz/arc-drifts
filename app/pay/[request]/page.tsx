import Image from "next/image";
import Link from "next/link";
import SiteFooter from "../../components/SiteFooter";

type PaymentRequest = {
  recipient?: string;
  amount?: string;
  memo?: string;
  type?: string;
  timeframe?: string;
};

function decodeRequest(value: string): PaymentRequest | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as PaymentRequest;

    if (!parsed.recipient || !parsed.amount) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export default async function PayRequestPage({ params }: { params: Promise<{ request: string }> }) {
  const { request } = await params;
  const paymentRequest = decodeRequest(request);

  return (
    <main className="min-h-screen bg-[#050505] text-[#EDEDED]">
      <nav className="border-b border-[#EDEDED]/10 bg-[#050505]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Arc Drift home">
            <Image src="/arc-drift-logo.svg" alt="" width={32} height={32} priority />
            <span className="text-sm font-semibold uppercase tracking-[0.28em]">Arc Drift</span>
          </Link>
          <Link href="/dashboard" className="text-xs uppercase tracking-[0.2em] text-[#AFAFAF] transition hover:text-[#ACC6E9]">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ACC6E9]">Public payment link</p>
            <h1 className="mt-5 max-w-2xl text-6xl font-medium leading-none">
              Fund a creator escrow.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#CFCFCF]">
              Shareable payment requests let agencies, clients, freelancers, and creators agree on a stream before opening the app.
            </p>
          </div>

          <div className="rounded-lg border border-[#EDEDED]/12 bg-[#151515] p-4">
            {paymentRequest ? (
              <div className="rounded-lg bg-[#EDEDED] p-6 text-[#050505]">
                <p className="text-xs uppercase tracking-[0.2em] text-[#4A4A4A]">Request details</p>
                <h2 className="mt-5 text-5xl font-medium">{paymentRequest.amount} USDC</h2>
                <div className="mt-8 grid gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#4A4A4A]">Recipient</p>
                    <p className="mt-2 break-all font-mono">{paymentRequest.recipient}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#4A4A4A]">Payment type</p>
                    <p className="mt-2">{paymentRequest.type ?? "Streaming escrow"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#4A4A4A]">Timeframe</p>
                    <p className="mt-2">{paymentRequest.timeframe ?? "Set in Arc Drift"}</p>
                  </div>
                  {paymentRequest.memo && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#4A4A4A]">Memo</p>
                      <p className="mt-2">{paymentRequest.memo}</p>
                    </div>
                  )}
                </div>
                <Link
                  href="/"
                  className="mt-8 grid h-12 place-items-center rounded-lg bg-[#050505] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#EDEDED] transition hover:bg-[#292929]"
                >
                  Open Arc Drift
                </Link>
              </div>
            ) : (
              <div className="rounded-lg bg-[#292929] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[#ACC6E9]">Invalid request</p>
                <h2 className="mt-5 text-4xl">This payment link is missing request data.</h2>
                <p className="mt-5 leading-7 text-[#AFAFAF]">
                  V2 payment links can be generated as encoded request payloads without requiring a database.
                </p>
                <pre className="mt-6 overflow-x-auto rounded-lg bg-[#050505] p-4 text-sm leading-7 text-[#EDEDED]">
                  <code>{`{
  "recipient": "0x...",
  "amount": "500",
  "type": "milestone streaming",
  "timeframe": "30 days",
  "memo": "Brand design sprint"
}`}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
