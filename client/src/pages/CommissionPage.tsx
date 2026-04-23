import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  DollarSign,
  Package,
  ChevronLeft,
  ChevronRight,
  Users2,
  Calendar,
} from "lucide-react";

type Period = "week" | "month" | "year";

function getPeriodRange(period: Period, offset: number): { startMs: number; endMs: number; label: string } {
  const now = new Date();
  if (period === "week") {
    const dayOfWeek = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return {
      startMs: monday.getTime(),
      endMs: sunday.getTime(),
      label: `${monday.toLocaleDateString(undefined, opts)} – ${sunday.toLocaleDateString(undefined, opts)}`,
    };
  } else if (period === "month") {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
      label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    };
  } else {
    const year = now.getFullYear() + offset;
    return {
      startMs: new Date(year, 0, 1).getTime(),
      endMs: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
      label: String(year),
    };
  }
}

export default function CommissionPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);

  const { startMs, endMs, label } = useMemo(() => getPeriodRange(period, offset), [period, offset]);

  const { data: reportData, isLoading } = trpc.commission.report.useQuery({ startMs, endMs });

  const totalSales = useMemo(
    () => (reportData ?? []).reduce((sum, crew) => sum + crew.totalSales, 0),
    [reportData]
  );

  const totalItems = useMemo(
    () => (reportData ?? []).reduce((sum, crew) => sum + crew.items.length, 0),
    [reportData]
  );

  // Commission rate — 10% by default (can be made configurable later)
  const COMMISSION_RATE = 0.10;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Commission Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Parts sold by crew member · {COMMISSION_RATE * 100}% commission rate</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setOffset(0); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">{label}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {offset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setOffset(0)} className="text-xs">
              Today
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total Parts Revenue</span>
            </div>
            {isLoading ? <Skeleton className="h-7 w-24" /> : (
              <p className="text-2xl font-bold">${totalSales.toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total Commission Owed</span>
            </div>
            {isLoading ? <Skeleton className="h-7 w-24" /> : (
              <p className="text-2xl font-bold text-blue-400">${(totalSales * COMMISSION_RATE).toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Parts Sold</span>
            </div>
            {isLoading ? <Skeleton className="h-7 w-16" /> : (
              <p className="text-2xl font-bold">{totalItems}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-crew breakdown */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (reportData ?? []).length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No parts sold during this period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(reportData ?? []).map((crew) => (
            <Card key={crew.crewMemberId ?? "unknown"} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-primary" />
                    {crew.crewMemberName ?? "Unknown Crew Member"}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      ${crew.totalSales.toFixed(2)} sold
                    </Badge>
                    <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                      ${(crew.totalSales * COMMISSION_RATE).toFixed(2)} commission
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-1.5">
                  {/* Group by part name */}
                  {Object.entries(
                    crew.items.reduce<Record<string, { name: string; qty: number; total: number }>>((acc, item) => {
                      const key = item.partName ?? "Unknown";
                      if (!acc[key]) acc[key] = { name: key, qty: 0, total: 0 };
                      acc[key].qty += item.quantity ?? 0;
                      acc[key].total += parseFloat(item.totalPrice ?? "0");
                      return acc;
                    }, {})
                  ).map(([key, agg]) => (
                    <div key={key} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{agg.name}</span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">×{agg.qty}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">${agg.total.toFixed(2)}</span>
                        <span className="text-xs text-blue-400">+${(agg.total * COMMISSION_RATE).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Sale dates */}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {crew.items.length} sale{crew.items.length !== 1 ? "s" : ""} recorded in this period
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
