"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, FlaskConical,
  Info, Leaf, ArrowRightLeft, Flame, Wallet, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { submitPendingCredit, type MintPayload, type PendingResponse } from "@/lib/api";
import {
  transferCreditOnChain, retireCreditOnChain, signSubmission,
  connectWallet as connectMetaMask, PARTICIPANT_REGISTRY, REGISTRAR_ADDRESS,
} from "@/lib/contract";
import { useWallet } from "@/lib/WalletContext";

function riskColor(score: number) {
  if (score >= 0.7) return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "HIGH RISK" };
  if (score >= 0.4) return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "MEDIUM RISK" };
  return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "LOW RISK" };
}

function sanitizeInt(v: string) {
  return v.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
}

type Banner = { type: "ok" | "err"; text: string };

type MintFormState = {
  project_id: string;
  project_type: string;
  description: string;
  tonnes: string;
  vintage_year: string;
};

const initialMint: MintFormState = {
  project_id: "VCS-001",
  project_type: "Cookstoves",
  description: "",
  tonnes: "5000",
  vintage_year: "2022",
};

export default function DeveloperPage() {
  const router = useRouter();
  const { wallet, connect, disconnect } = useWallet();

  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [mintForm, setMintForm] = useState<MintFormState>(initialMint);
  const [mintResult, setMintResult] = useState<PendingResponse | null>(null);
  const [mintMsg, setMintMsg] = useState<Banner | null>(null);
  const [mintLoading, setMintLoading] = useState(false);

  const [txCreditId, setTxCreditId] = useState("");
  const [txTo, setTxTo] = useState("");
  const [txMsg, setTxMsg] = useState<Banner | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);

  const [retireCreditId, setRetireCreditId] = useState("");
  const [retireMsg, setRetireMsg] = useState<Banner | null>(null);
  const [retireHash, setRetireHash] = useState<string | null>(null);
  const [retireLoading, setRetireLoading] = useState(false);

  const isRegistrar = wallet?.address === REGISTRAR_ADDRESS;
  const canSubmit = wallet?.role === "Developer";
  const canTransact = wallet && !isRegistrar;

  async function handleConnect() {
    setConnectError(null);
    setConnecting(true);
    try {
      const participant = await connectMetaMask();
      connect(participant);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    setTxMsg(null);
    setTxHash(null);
    setRetireMsg(null);
    setRetireHash(null);
  }

  async function onMintSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setMintMsg(null);
    setMintLoading(true);
    try {
      const sig = await signSubmission(
        mintForm.project_id.trim(),
        mintForm.project_type.trim(),
        Number(mintForm.tonnes),
      );
      const payload: MintPayload = {
        project_id: mintForm.project_id.trim(),
        project_type: mintForm.project_type.trim(),
        tonnes: Number(mintForm.tonnes),
        vintage_year: Number(mintForm.vintage_year),
        owner_id: wallet!.name,
        developer_id: wallet!.name,
        regulator_id: "EPA Registry",
        developer_signature: sig,
      };
      const res = await submitPendingCredit(payload);
      setMintResult(res);
      setMintMsg({ type: "ok", text: `✓ Submitted. Awaiting regulator approval — Pending ID: ${res.pending_id}` });
    } catch (err) {
      setMintMsg({ type: "err", text: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setMintLoading(false);
    }
  }

  async function onTransfer(e: { preventDefault(): void }) {
    e.preventDefault();
    setTxMsg(null);
    setTxHash(null);
    setTxLoading(true);
    try {
      const hash = await transferCreditOnChain(txCreditId.trim(), txTo);
      setTxHash(hash);
      setTxMsg({ type: "ok", text: "✓ Credit transferred successfully." });
    } catch (err) {
      setTxMsg({ type: "err", text: err instanceof Error ? err.message : "Transfer failed." });
    } finally {
      setTxLoading(false);
    }
  }

  async function onRetire(e: { preventDefault(): void }) {
    e.preventDefault();
    setRetireMsg(null);
    setRetireHash(null);
    setRetireLoading(true);
    try {
      const hash = await retireCreditOnChain(retireCreditId.trim());
      setRetireHash(hash);
      setRetireMsg({ type: "ok", text: "✓ Credit permanently retired." });
    } catch (err) {
      setRetireMsg({ type: "err", text: err instanceof Error ? err.message : "Retire failed." });
    } finally {
      setRetireLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-green-50 to-emerald-100/80 px-6 py-10 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Developer Console</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              Each credit is AI-scored before minting and permanently recorded on Ethereum.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/explorer")}>Open Explorer</Button>
        </div>

        {/* Wallet bar */}
        {!wallet ? (
          <Card className="border border-border/70 bg-white shadow-sm">
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4 text-primary" /> Connect your MetaMask wallet to continue
              </div>
              <p className="text-xs text-muted-foreground">
                Make sure MetaMask is installed, connected to Hardhat (Chain ID 31337), and your account is a registered participant.
              </p>
              {connectError && (
                <p className="text-xs text-red-600">{connectError}</p>
              )}
              <Button onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto">
                {connecting ? "Connecting…" : "Connect MetaMask"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-200">
                <Wallet className="h-4 w-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">{wallet.name} <span className="font-normal text-emerald-700">· {wallet.role}</span></p>
                <p className="font-mono text-xs text-emerald-700">{wallet.address}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-emerald-700 hover:bg-emerald-100">
              <LogOut className="mr-1.5 h-4 w-4" /> Disconnect
            </Button>
          </div>
        )}

        {!wallet && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Connect your MetaMask wallet above. Developers can submit credit requests. Buyers can transfer and retire.
          </div>
        )}

        {mintMsg && (
          <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${mintMsg.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {mintMsg.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {mintMsg.text}
          </div>
        )}

        {/* Submit Credit Request — Developers only */}
        {canSubmit && <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border border-border/70 bg-white shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FlaskConical className="h-5 w-5 text-primary" /> Submit Credit Request
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={onMintSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="project_id">Project ID</Label>
                  <Input id="project_id" placeholder="VCS-001" value={mintForm.project_id}
                    onChange={(e) => setMintForm((p) => ({ ...p, project_id: e.target.value }))} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project_type">Project Type</Label>
                  <Input id="project_type" placeholder="e.g. Cookstoves, Wind, REDD+" value={mintForm.project_type}
                    onChange={(e) => setMintForm((p) => ({ ...p, project_type: e.target.value }))} required />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="description">Project Description</Label>
                  <textarea
                    id="description"
                    rows={3}
                    placeholder="Describe what this project does and how it reduces carbon emissions…"
                    value={mintForm.description}
                    onChange={(e) => setMintForm((p) => ({ ...p, description: e.target.value }))}
                    required
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tonnes">Tonnes of CO₂</Label>
                  <Input id="tonnes" inputMode="numeric" placeholder="e.g. 5000" value={mintForm.tonnes}
                    onChange={(e) => setMintForm((p) => ({ ...p, tonnes: sanitizeInt(e.target.value) }))} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vintage_year">Vintage Year</Label>
                  <Input id="vintage_year" inputMode="numeric" placeholder="e.g. 2022" value={mintForm.vintage_year}
                    onChange={(e) => setMintForm((p) => ({ ...p, vintage_year: sanitizeInt(e.target.value) }))} required />
                </div>
                <div className="md:col-span-2 grid gap-3">
                  <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                    Submitting as <strong className="mx-1">{wallet?.name}</strong> — MetaMask will ask you to sign this request. Owner and Developer are set from your connected wallet.
                  </div>
                  <Button type="submit" disabled={mintLoading} className="w-full bg-primary hover:bg-primary/90">
                    {mintLoading ? "Waiting for MetaMask…" : "Sign & Submit for Approval"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-white shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg">AI Risk Score &amp; Submission Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {!mintResult ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <Leaf className="h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm">Submit a credit request to see the AI risk score here.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {(() => {
                    const c = riskColor(mintResult.ai_risk_score);
                    return (
                      <div className={`flex items-center justify-between rounded-xl border ${c.border} ${c.bg} px-5 py-4`}>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI Fraud Risk</p>
                          <p className={`mt-1 text-4xl font-bold ${c.text}`}>{mintResult.ai_risk_score.toFixed(4)}</p>
                        </div>
                        <Badge className={`${c.bg} ${c.text} border ${c.border} px-3 py-1 text-sm`}>{c.label}</Badge>
                      </div>
                    );
                  })()}
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Pending ID</span>
                      <span className="font-mono font-medium text-primary">{mintResult.pending_id}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Credit ID (when approved)</span>
                      <span className="font-mono font-medium">{mintResult.credit_id}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    Awaiting EPA Registry approval. The credit mints on-chain only after the Regulator signs.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>}

        {/* Transfer & Retire */}
        {canTransact && <div className="grid gap-6 xl:grid-cols-2">

          <Card className="border border-border/70 bg-white shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowRightLeft className="h-5 w-5 text-primary" /> Transfer Credit
                <Badge className="ml-auto border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-normal">
                  Signed as {wallet?.name.split(" ")[0]}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={onTransfer} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tx_credit_id">Credit ID</Label>
                  <Input id="tx_credit_id" placeholder="CRED-XXXXXXXX" value={txCreditId}
                    onChange={(e) => setTxCreditId(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tx_to">Transfer to</Label>
                  <select id="tx_to" required value={txTo} onChange={(e) => setTxTo(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="" disabled>Select recipient…</option>
                    {Object.entries(PARTICIPANT_REGISTRY)
                      .filter(([addr]) => addr !== wallet?.address)
                      .map(([addr, { name, role }]) => (
                        <option key={addr} value={addr}>[{role}] {name} — {addr.slice(0, 10)}…</option>
                      ))}
                  </select>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  MetaMask will ask you to sign. The contract rejects this if you are not the current owner.
                </div>
                <Button type="submit" disabled={txLoading} variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/5">
                  {txLoading ? "Waiting for MetaMask…" : "Transfer Credit"}
                </Button>
                {txMsg && (
                  <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${txMsg.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                    {txMsg.type === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div>
                      <p>{txMsg.text}</p>
                      {txHash && <p className="mt-1 break-all font-mono text-xs opacity-80">{txHash}</p>}
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-white shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flame className="h-5 w-5 text-orange-500" /> Retire Credit
                <Badge className="ml-auto border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-normal">
                  Signed as {wallet?.name.split(" ")[0]}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={onRetire} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="retire_credit_id">Credit ID</Label>
                  <Input id="retire_credit_id" placeholder="CRED-XXXXXXXX" value={retireCreditId}
                    onChange={(e) => setRetireCreditId(e.target.value)} required />
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                  Retirement is <strong className="mx-0.5">irreversible</strong>. MetaMask will ask you to sign. The credit is permanently burned on-chain.
                </div>
                <Button type="submit" disabled={retireLoading} variant="outline" className="w-full border-orange-300 text-orange-600 hover:bg-orange-50">
                  {retireLoading ? "Waiting for MetaMask…" : "Retire Credit"}
                </Button>
                {retireMsg && (
                  <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${retireMsg.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                    {retireMsg.type === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div>
                      <p>{retireMsg.text}</p>
                      {retireHash && <p className="mt-1 break-all font-mono text-xs opacity-80">{retireHash}</p>}
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

        </div>}

      </div>
    </div>
  );
}
