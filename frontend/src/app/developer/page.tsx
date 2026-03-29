"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  ArrowRightLeft,
  Flame,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  issueCredit,
  transferCredit,
  retireCredit,
  type MintPayload,
  type TransferPayload,
  type RetirePayload,
  type MintResponse,
  fetchCreditHistory,
  type CreditHistoryResponse,
} from "@/lib/api";

function riskVariant(score: number): "destructive" | "outline" | "default" {
  if (score >= 0.8) return "destructive";
  if (score >= 0.5) return "outline";
  return "default";
}

function riskLabel(score: number) {
  if (score >= 0.8) return "HIGH RISK";
  if (score >= 0.5) return "MEDIUM RISK";
  return "LOW RISK";
}

function sanitizeInt(v: string) {
  return v.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
}

type MintFormState = {
  project_id: string;
  project_type: string;
  tonnes: string;
  vintage_year: string;
  owner_id: string;
  developer_id: string;
  regulator_id: string;
};

type TransferFormState = {
  credit_id: string;
  from_owner: string;
  to_owner: string;
  units: string;
};

const initialMint: MintFormState = {
  project_id: "VCS-001",
  project_type: "Cookstoves",
  tonnes: "500000",
  vintage_year: "2011",
  owner_id: "Shady-Dev-Corp",
  developer_id: "Dev-Org-Alpha",
  regulator_id: "GOV-EPA-001",
};

const initialTransfer: TransferFormState = {
  credit_id: "",
  from_owner: "",
  to_owner: "",
  units: "100",
};

const initialRetire: RetirePayload = {
  credit_id: "",
  owner_id: "",
};

export default function DeveloperPage() {
  const [mintForm, setMintForm] = useState<MintFormState>(initialMint);
  const [transferForm, setTransferForm] = useState<TransferFormState>(initialTransfer);
  const [retireForm, setRetireForm] = useState<RetirePayload>(initialRetire);
  const [mintResult, setMintResult] = useState<MintResponse | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState<"mint" | "transfer" | "retire" | null>(null);

  async function onMintSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoadingAction("mint");

    const payload: MintPayload = {
      project_id: mintForm.project_id.trim(),
      project_type: mintForm.project_type.trim(),
      tonnes: Number(mintForm.tonnes),
      vintage_year: Number(mintForm.vintage_year),
      owner_id: mintForm.owner_id.trim(),
      developer_id: mintForm.developer_id.trim(),
      regulator_id: mintForm.regulator_id.trim(),
      // r_ratio / m_flag / t_flag intentionally omitted — backend auto-computes them
    };

    try {
      const res = await issueCredit(payload);
      setMintResult(res);
      setTransferForm((p) => ({ ...p, credit_id: res.credit_id, from_owner: res.owner_id }));
      setRetireForm((p) => ({ ...p, credit_id: res.credit_id, owner_id: res.owner_id }));
      setMessage({ type: "ok", text: `Minted ${res.credit_id} in block #${res.block_index}.` });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Mint request failed." });
    } finally {
      setLoadingAction(null);
    }
  }

  async function onTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoadingAction("transfer");

    const payload: TransferPayload = {
      credit_id: transferForm.credit_id,
      from_owner: transferForm.from_owner,
      to_owner: transferForm.to_owner,
      units: Number(transferForm.units),
    };

    try {
      await transferCredit(payload);
      setMessage({ type: "ok", text: `Transferred ${payload.units.toLocaleString()} units successfully.` });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Transfer request failed." });
    } finally {
      setLoadingAction(null);
    }
  }

  async function onRetireSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoadingAction("retire");
    try {
      await retireCredit(retireForm);
      setMessage({ type: "ok", text: `Retired ${retireForm.credit_id} successfully.` });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Retire request failed." });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_40%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_25%)] px-6 py-10 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Developer Console</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              Submit mint, transfer, and retire transactions to your FastAPI backend. Risk features are auto-computed by the AI engine — no manual entry needed.
            </p>
          </div>
          <Button variant="outline" onClick={() => (window.location.href = "/explorer")}>
            Open Explorer
          </Button>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${message.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/40 bg-red-500/10 text-red-200"
              }`}
          >
            {message.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {/* ── Mint form ── */}
          <Card className="border border-border/70 bg-card/65">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FlaskConical className="h-5 w-5 text-primary" /> Mint Credit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onMintSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="project_id">Project ID</Label>
                  <Input
                    id="project_id"
                    placeholder="VCS-001"
                    value={mintForm.project_id}
                    onChange={(e) => setMintForm((p) => ({ ...p, project_id: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="project_type">Project Type</Label>
                  <Input
                    id="project_type"
                    placeholder="e.g. Cookstoves, Wind, REDD+"
                    value={mintForm.project_type}
                    onChange={(e) => setMintForm((p) => ({ ...p, project_type: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tonnes">Tonnes of CO₂</Label>
                  <Input
                    id="tonnes"
                    inputMode="numeric"
                    placeholder="e.g. 500000"
                    value={mintForm.tonnes}
                    onChange={(e) =>
                      setMintForm((p) => ({ ...p, tonnes: sanitizeInt(e.target.value) }))
                    }
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="vintage_year">Vintage Year</Label>
                  <Input
                    id="vintage_year"
                    inputMode="numeric"
                    placeholder="e.g. 2011"
                    value={mintForm.vintage_year}
                    onChange={(e) =>
                      setMintForm((p) => ({ ...p, vintage_year: sanitizeInt(e.target.value) }))
                    }
                    required
                  />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="owner_id">Owner ID</Label>
                  <Input
                    id="owner_id"
                    placeholder="e.g. GreenCorp-Ltd"
                    value={mintForm.owner_id}
                    onChange={(e) => setMintForm((p) => ({ ...p, owner_id: e.target.value }))}
                    required
                  />
                </div>

                {/* Endorsement policy: dual approval */}
                <div className="grid gap-2">
                  <Label htmlFor="developer_id">Developer ID (Endorsement)</Label>
                  <Input
                    id="developer_id"
                    placeholder="e.g. Dev-Org-Alpha"
                    value={mintForm.developer_id}
                    onChange={(e) => setMintForm((p) => ({ ...p, developer_id: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="regulator_id">Regulator ID (Gov. Approval)</Label>
                  <Input
                    id="regulator_id"
                    placeholder="e.g. GOV-EPA-001"
                    value={mintForm.regulator_id}
                    onChange={(e) => setMintForm((p) => ({ ...p, regulator_id: e.target.value }))}
                    required
                  />
                </div>

                {/* Notice about auto-computed features */}
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  Risk features (R ratio, M flag, T flag, Vintage Age) are automatically derived by the AI engine. Endorsement policy requires both Developer and Regulator approval to mint.
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" disabled={loadingAction === "mint"} className="w-full">
                    {loadingAction === "mint" ? "Scoring + Mining…" : "Score + Mint Credit"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* ── AI Score + Block result ── */}
          <Card className="border border-border/70 bg-card/65">
            <CardHeader>
              <CardTitle className="text-lg">AI Score &amp; Block Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {!mintResult && (
                <p className="text-muted-foreground">
                  Mint a credit to see the AI risk score, auto-computed features, and block metadata here.
                </p>
              )}

              {mintResult && (
                <>
                  {/* Score badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={riskVariant(mintResult.ai_risk_score)}>
                      {riskLabel(mintResult.ai_risk_score)}
                    </Badge>
                    <Badge variant="outline">Risk Score: {mintResult.ai_risk_score.toFixed(4)}</Badge>
                    <Badge variant="secondary">{mintResult.credit_id}</Badge>
                  </div>

                  <Separator />

                  {/* Auto-computed features — read-only */}
                  {mintResult.computed_features && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Auto-Computed Features
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                          <p className="text-muted-foreground">R Ratio</p>
                          <p className="mt-0.5 font-mono text-base font-semibold text-foreground">
                            {mintResult.computed_features.R_ratio.toFixed(2)}×
                          </p>
                        </div>
                        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                          <p className="text-muted-foreground">Vintage Age</p>
                          <p className="mt-0.5 font-mono text-base font-semibold text-foreground">
                            {mintResult.computed_features.Vintage_Age} yrs
                          </p>
                        </div>
                        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                          <p className="text-muted-foreground">M Flag</p>
                          <p className={`mt-0.5 font-mono text-base font-semibold ${mintResult.computed_features.M_flag ? "text-red-400" : "text-emerald-400"}`}>
                            {mintResult.computed_features.M_flag ? "1 — High-risk type" : "0 — Normal type"}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                          <p className="text-muted-foreground">T Flag</p>
                          <p className={`mt-0.5 font-mono text-base font-semibold ${mintResult.computed_features.T_flag ? "text-red-400" : "text-emerald-400"}`}>
                            {mintResult.computed_features.T_flag ? "1 — Spike detected" : "0 — Normal issuance"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Block metadata */}
                  <div className="grid gap-2 text-muted-foreground">
                    <p><span className="text-foreground">Owner:</span> {mintResult.owner_id}</p>
                    <p><span className="text-foreground">Tonnes:</span> {mintResult.tonnes.toLocaleString()}</p>
                    <p><span className="text-foreground">Block:</span> #{mintResult.block_index}</p>
                    <p className="break-all"><span className="text-foreground">Hash:</span> {mintResult.block_hash}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* ── Transfer ── */}
          <Card className="border border-border/70 bg-card/65">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowRightLeft className="h-5 w-5 text-primary" /> Transfer Credit Units
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onTransferSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="transfer_credit_id">Credit ID</Label>
                  <Input
                    id="transfer_credit_id"
                    placeholder="CRED-XXXXXXXX"
                    value={transferForm.credit_id}
                    onChange={(e) => setTransferForm((p) => ({ ...p, credit_id: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="from_owner">From Owner</Label>
                  <Input
                    id="from_owner"
                    placeholder="Seller-Corp"
                    value={transferForm.from_owner}
                    onChange={(e) => setTransferForm((p) => ({ ...p, from_owner: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="to_owner">To Owner</Label>
                  <Input
                    id="to_owner"
                    placeholder="Buyer-Corp"
                    value={transferForm.to_owner}
                    onChange={(e) => setTransferForm((p) => ({ ...p, to_owner: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="units">Units to Transfer</Label>
                  <Input
                    id="units"
                    inputMode="numeric"
                    placeholder="e.g. 200000"
                    value={transferForm.units}
                    onChange={(e) =>
                      setTransferForm((p) => ({ ...p, units: sanitizeInt(e.target.value) }))
                    }
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" variant="secondary" disabled={loadingAction === "transfer"} className="w-full">
                    {loadingAction === "transfer" ? "Transferring…" : "Transfer Units"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* ── Retire ── */}
          <Card className="border border-border/70 bg-card/65">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flame className="h-5 w-5 text-primary" /> Retire Credit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onRetireSubmit} className="grid gap-4">
                <p className="text-xs text-muted-foreground">
                  Retiring permanently removes the credit from circulation — this cannot be undone.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="retire_credit_id">Credit ID</Label>
                  <Input
                    id="retire_credit_id"
                    placeholder="CRED-XXXXXXXX"
                    value={retireForm.credit_id}
                    onChange={(e) => setRetireForm((p) => ({ ...p, credit_id: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="retire_owner">Your Owner ID</Label>
                  <Input
                    id="retire_owner"
                    placeholder="Owner who holds the credit"
                    value={retireForm.owner_id}
                    onChange={(e) => setRetireForm((p) => ({ ...p, owner_id: e.target.value }))}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={loadingAction === "retire"}
                  className="w-full border-red-500/40 text-red-300 hover:bg-red-500/10"
                >
                  {loadingAction === "retire" ? "Retiring…" : "Permanently Retire"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
