"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, CheckCircle2, AlertTriangle, Loader2, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchPendingCredits, approveCredit, type PendingCredit } from "@/lib/api";
import { signEndorsement, connectWallet as connectMetaMask } from "@/lib/contract";
import { useWallet } from "@/lib/WalletContext";

type Banner = { type: "ok" | "err"; text: string };

const REGULATOR_ADDRESS = "0x976EA74026E726554dB657fA54763abd0C3a0aa9";

function riskColor(score: number) {
    if (score >= 0.7) return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "HIGH RISK" };
    if (score >= 0.4) return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "MEDIUM RISK" };
    return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "LOW RISK" };
}

export default function RegulatorPage() {
    const router = useRouter();
    const { wallet, connect, disconnect } = useWallet();

    const [connecting, setConnecting] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);
    const [pending, setPending] = useState<PendingCredit[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [banners, setBanners] = useState<Record<string, Banner>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [fetching, setFetching] = useState(false);

    const isRegulator = wallet?.address.toLowerCase() === REGULATOR_ADDRESS.toLowerCase();

    async function loadPending() {
        setFetching(true);
        setFetchError(null);
        try {
            const all = await fetchPendingCredits();
            setPending(all.filter((c) => c.status === "pending"));
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : "Failed to load pending credits.");
        } finally {
            setFetching(false);
        }
    }

    useEffect(() => {
        if (!isRegulator) return;
        void loadPending();
        const poll = setInterval(loadPending, 5000);
        return () => clearInterval(poll);
    }, [isRegulator]);

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

    function disconnectWallet() {
        disconnect();
        setPending([]);
        setFetchError(null);
    }

    async function onApprove(credit: PendingCredit) {
        if (!wallet) return;
        setLoading((p) => ({ ...p, [credit.pending_id]: true }));
        setBanners((p) => { const n = { ...p }; delete n[credit.pending_id]; return n; });

        try {
            const sig = await signEndorsement(credit.credit_id, credit.developer_id, credit.tonnes);
            await approveCredit(credit.pending_id, wallet.address, sig);
            setBanners((p) => ({ ...p, [credit.pending_id]: { type: "ok", text: `✓ Credit ${credit.credit_id} approved and minted on-chain.` } }));
            setPending((p) => p.filter((c) => c.pending_id !== credit.pending_id));
        } catch (err) {
            setBanners((p) => ({ ...p, [credit.pending_id]: { type: "err", text: err instanceof Error ? err.message : "Approval failed." } }));
        } finally {
            setLoading((p) => ({ ...p, [credit.pending_id]: false }));
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-50/80 px-6 py-10 lg:px-10">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link href="/" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" /> Back to Home
                        </Link>
                        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Regulator Dashboard</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                            Review and approve pending carbon credit submissions. Each approval is signed with your private key and verified on-chain.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push("/developer")}>Developer Console</Button>
                </div>

                {!wallet ? (
                    <Card className="border border-border/70 bg-white shadow-sm">
                        <CardContent className="flex flex-col gap-3 pt-5">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Wallet className="h-4 w-4 text-primary" /> Connect your MetaMask wallet
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Make sure MetaMask is installed, connected to Hardhat (Chain ID 31337), and your account is the EPA Registry.
                            </p>
                            {connectError && <p className="text-xs text-red-600">{connectError}</p>}
                            <Button onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto">
                                {connecting ? "Connecting…" : "Connect MetaMask"}
                            </Button>
                        </CardContent>
                    </Card>
                ) : !isRegulator ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        Connected as {wallet.name} ({wallet.role}) — only EPA Registry can approve credits. Disconnect and connect as the Regulator.
                    </div>
                ) : (
                    <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-200">
                                <ShieldCheck className="h-4 w-4 text-blue-700" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-blue-900">{wallet.name}</p>
                                <p className="font-mono text-xs text-blue-700">{wallet.address}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={disconnectWallet} className="text-blue-700 hover:bg-blue-100">
                            <LogOut className="mr-1.5 h-4 w-4" /> Disconnect
                        </Button>
                    </div>
                )}

                {isRegulator && (
                    <>
                        {fetchError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                {fetchError}
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {pending.length === 0 ? "No pending credits." : `${pending.length} credit${pending.length > 1 ? "s" : ""} awaiting approval`}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                                    live · refreshes every 5s
                                </span>
                                <Button variant="outline" size="sm" onClick={loadPending} disabled={fetching}>
                                    {fetching ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Refreshing</> : "Refresh"}
                                </Button>
                            </div>
                        </div>

                        {pending.length === 0 && !fetching && !fetchError && (
                            <Card className="border border-border/70 bg-white shadow-sm">
                                <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                                    <ShieldCheck className="h-10 w-10 opacity-20" />
                                    <p className="text-sm">No pending submissions right now.</p>
                                </CardContent>
                            </Card>
                        )}

                        <div className="flex flex-col gap-5">
                            {pending.map((credit) => {
                                const risk = riskColor(credit.risk_score);
                                const banner = banners[credit.pending_id];
                                const isLoading = loading[credit.pending_id];

                                return (
                                    <Card key={credit.pending_id} className="border border-border/70 bg-white shadow-sm">
                                        <CardHeader className="border-b border-border/50 pb-4">
                                            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                                                <span className="font-mono">{credit.credit_id}</span>
                                                <Badge variant="secondary">{credit.project_type}</Badge>
                                                <Badge className={`border ${risk.border} ${risk.bg} ${risk.text} text-xs`}>{risk.label}</Badge>
                                                <Badge className="border border-amber-200 bg-amber-50 text-amber-700 text-xs">PENDING</Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-5 space-y-4">
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                                                {[
                                                    { label: "Project ID", value: credit.project_id },
                                                    { label: "Developer", value: credit.developer_id },
                                                    { label: "Owner", value: credit.owner_id },
                                                    { label: "Tonnes CO₂", value: credit.tonnes.toLocaleString() },
                                                    { label: "Vintage Year", value: credit.vintage_year.toString() },
                                                    { label: "AI Risk Score", value: credit.risk_score.toFixed(4) },
                                                    { label: "Pending ID", value: credit.pending_id },
                                                    { label: "Submitted", value: new Date(credit.submitted_at).toLocaleString() },
                                                ].map(({ label, value }) => (
                                                    <div key={label} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                                                        <p className="text-xs text-muted-foreground">{label}</p>
                                                        <p className="mt-0.5 font-mono text-sm font-medium break-all">{value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {banner && (
                                                <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${banner.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                                                    {banner.type === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                                                    {banner.text}
                                                </div>
                                            )}

                                            <Button onClick={() => onApprove(credit)} disabled={isLoading} className="w-full">
                                                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing & Minting…</> : "Approve & Sign"}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
