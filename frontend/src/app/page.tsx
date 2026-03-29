"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Leaf,
  Activity,
  LineChart,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchChainStats, type ChainStatsResponse } from "@/lib/api";

const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<ChainStatsResponse | null>(null);

  useEffect(() => {
    fetchChainStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(18,136,84,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(34,197,94,0.18),transparent_30%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_25%)]" />

      <header className="relative z-10 border-b border-border/60 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span className="rounded-md bg-primary/20 p-1.5 text-primary">
              <Leaf className="h-4.5 w-4.5" />
            </span>
            VeridiumAI
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <Link href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </Link>
            <Link href="/explorer" className="transition-colors hover:text-foreground">
              Explorer
            </Link>
            <Link
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </Link>
          </nav>

          <Button
            variant="outline"
            className="border-border/70 bg-card/50"
            onClick={() => router.push("/developer")}
          >
            Launch App
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-20 px-6 py-16 md:py-24 lg:px-10">
        <section className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="space-y-8"
          >
            <Badge variant="outline" className="h-7 border-emerald-500/30 bg-emerald-500/10 px-3 text-emerald-300">
              Eliminating $250M+ in Carbon Fraud
            </Badge>

            <h1 className="max-w-4xl text-5xl leading-[1.04] font-semibold tracking-tight md:text-6xl lg:text-7xl">
              Intelligent Carbon
              <br className="hidden md:block" />
              Credit Integrity.
            </h1>

            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-xl md:leading-8">
              Blockchain immutability meets real-time AI anomaly detection.
              Verify, mint, and retire carbon credits with zero double-counting
              and absolute cryptographic trust.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="group" onClick={() => router.push("/developer")}
              >
                Mint a Credit
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="secondary" onClick={() => router.push("/explorer")}
              >
                Explore Ledger
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
          >
            <Card className="border border-border/70 bg-card/70 py-0 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_28px_60px_-30px_rgba(16,185,129,0.45)]">
              <CardHeader className="border-b border-border/60 py-5">
                <CardTitle className="text-sm tracking-wide text-muted-foreground">
                  Live Integrity Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Chain Length</span>
                  <span className="font-semibold text-emerald-300">{stats?.chain_length ?? "—"} blocks</span>
                </div>
                <div className="h-2 rounded-full bg-secondary/80">
                  <div className="h-2 w-[82%] rounded-full bg-primary" />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Credits Scanned</p>
                    <p className="mt-1 text-xl font-semibold">{stats?.total_credits?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Fraud Flags</p>
                    <p className="mt-1 text-xl font-semibold">{stats?.flagged_high_risk?.toLocaleString() ?? "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        <section id="how-it-works" className="grid gap-6 md:grid-cols-3">
          <Card className="border border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Real-Time AI Scoring
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Isolation Forest ML evaluates project metadata instantly to flag
              phantom credits before minting.
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Dual-Key Endorsement
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Requires both Developer and Regulator endorsement before any
              credit can be minted, preventing unilateral forgery.
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Leaf className="h-5 w-5 text-primary" />
                Immutable Retirements
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Credits are permanently burned on a custom PoW ledger,
              guaranteeing zero double-counting for ESG compliance.
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border/70 bg-card/40 p-6 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <LineChart className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Model + Ledger Unity</p>
              <p className="text-sm text-muted-foreground">
                Every mint action is AI-scored first, then permanently committed.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Institution-Ready Audit Trail</p>
              <p className="text-sm text-muted-foreground">
                Full transaction history per credit with block-level traceability.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Compliance by Design</p>
              <p className="text-sm text-muted-foreground">
                Detect high-risk issuances early before they impact ESG reporting.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
