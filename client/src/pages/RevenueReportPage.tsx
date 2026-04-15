import { useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, CheckCircle2, Printer } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  on_hold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  completed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
};
const TYPE_LABELS: Record<string, string> = {
  new_construction: "New Construction",
  commercial: "Commercial",
  retrofit: "Retrofit",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function monthKey(ms: number | null | undefined) {
  if (!ms) return "Unknown";
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function RevenueReportPage() {
  const { data, isLoading } = trpc.projects.revenueReport.useQuery();
  const printRef = useRef<HTMLDivElement>(null);

  const monthlyData = useMemo(() => {
    if (!data?.closed) return [];
    const map = new Map<string, { month: string; value: number; sortKey: number }>();
    for (const p of data.closed) {
      const key = monthKey(p.completedAt);
      const sortKey = p.completedAt ?? 0;
      const existing = map.get(key);
      const val = parseFloat(String(p.projectValue ?? "0"));
      if (existing) {
        existing.value += val;
        if (sortKey > existing.sortKey) existing.sortKey = sortKey;
      } else {
        map.set(key, { month: key, value: val, sortKey });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-12); // last 12 months
  }, [data]);

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">Loading report...</p>
      </div>
    );
  }

  const pipeline = data?.pipeline ?? [];
  const closed = data?.closed ?? [];
  const pipelineTotal = data?.pipelineTotal ?? 0;
  const closedTotal = data?.closedTotal ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto print:p-4" ref={printRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Project pipeline and closed revenue — as of {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} className="print:hidden gap-2">
          <Printer className="h-4 w-4" /> Print / Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Live Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(pipelineTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{pipeline.length} active / on-hold project{pipeline.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              Total Closed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(closedTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{closed.length} completed project{closed.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-violet-500" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(pipelineTotal + closedTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Pipeline + closed combined</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Closed Bar Chart */}
      {monthlyData.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Monthly Closed Revenue (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [fmt(v), "Revenue"]} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Table */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Live Pipeline — {fmt(pipelineTotal)}
        </h2>
        {pipeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active projects with a value set.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Project</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Client</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-4 py-2.5 font-medium">{p.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{p.clientName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                      {p.projectType ? TYPE_LABELS[p.projectType] ?? p.projectType : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={STATUS_COLORS[p.status] ?? ""}>{STATUS_LABELS[p.status] ?? p.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {fmt(parseFloat(String(p.projectValue ?? "0")))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-emerald-500/10 font-semibold">
                  <td className="px-4 py-2.5" colSpan={4}>Total Pipeline</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(pipelineTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Revenue Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          Closed Revenue — {fmt(closedTotal)}
        </h2>
        {closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed projects with a value set yet.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Project</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Client</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Closed</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-4 py-2.5 font-medium">{p.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{p.clientName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                      {p.projectType ? TYPE_LABELS[p.projectType] ?? p.projectType : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {p.completedAt ? new Date(p.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {fmt(parseFloat(String(p.projectValue ?? "0")))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-500/10 font-semibold">
                  <td className="px-4 py-2.5" colSpan={4}>Total Closed</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(closedTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
