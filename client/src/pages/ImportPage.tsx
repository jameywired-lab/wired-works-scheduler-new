import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Upload,
  Users,
  UserCircle2,
  X,
} from "lucide-react";
import Papa from "papaparse";
import { useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CsvRow = Record<string, string>;

type ImportType = "clients" | "crew";

type Step = "upload" | "map" | "preview" | "done";

// Client column fields
const CLIENT_FIELDS = [
  { key: "name", label: "Full Name", required: true },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "addressLine1", label: "Address Line 1" },
  { key: "addressLine2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP Code" },
  { key: "notes", label: "Notes" },
] as const;

const CREW_FIELDS = [
  { key: "name", label: "Full Name", required: true },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "role", label: "Job Title / Role" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Try to auto-detect a column mapping based on common header names */
function autoDetectClientMapping(headers: string[]): Record<string, string> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c));
      if (idx !== -1) return headers[idx];
    }
    return "";
  };
  return {
    name: find("full name", "name", "client name", "customer name", "contact name"),
    phone: find("phone", "mobile", "cell", "telephone"),
    email: find("email", "e-mail", "mail"),
    addressLine1: find("address 1", "address1", "street", "address line 1", "billing street"),
    addressLine2: find("address 2", "address2", "address line 2", "billing street 2"),
    city: find("city", "billing city"),
    state: find("state", "province", "billing state"),
    zip: find("zip", "postal", "billing zip"),
    notes: find("notes", "note", "description", "memo"),
  };
}

function autoDetectCrewMapping(headers: string[]): Record<string, string> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c));
      if (idx !== -1) return headers[idx];
    }
    return "";
  };
  return {
    name: find("full name", "name", "employee", "worker"),
    phone: find("phone", "mobile", "cell"),
    email: find("email", "e-mail"),
    role: find("role", "title", "position", "job title"),
  };
}

// Sample CSV content
const CLIENT_SAMPLE_CSV = `Full Name,Phone,Email,Address Line 1,City,State,ZIP,Notes
Jane Smith,(904) 555-0101,jane@example.com,123 Oak St,Jacksonville,FL,32202,Prefers morning appointments
Bob Johnson,(904) 555-0202,bob@example.com,456 Pine Ave,Jacksonville,FL,32204,
`;

const CREW_SAMPLE_CSV = `Full Name,Phone,Email,Job Title
Mike Torres,(904) 555-0301,mike@wiredworks.com,Lead Electrician
Sarah Lee,(904) 555-0302,sarah@wiredworks.com,Apprentice
`;

function downloadSample(type: ImportType) {
  const content = type === "clients" ? CLIENT_SAMPLE_CSV : CREW_SAMPLE_CSV;
  const filename = type === "clients" ? "clients-template.csv" : "crew-template.csv";
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "map", label: "Map Columns" },
    { id: "preview", label: "Preview" },
    { id: "done", label: "Done" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              i < idx
                ? "bg-primary/20 text-primary"
                : i === idx
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i < idx ? <CheckCircle2 className="h-3 w-3" /> : <span>{i + 1}</span>}
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ImportPage
// ---------------------------------------------------------------------------

export default function ImportPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Bring in clients and crew from CSV files, Jobber, or QuickBooks.
        </p>
      </div>

      <Tabs defaultValue="clients">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="clients" className="gap-2">
            <UserCircle2 className="h-4 w-4" /> Clients
          </TabsTrigger>
          <TabsTrigger value="crew" className="gap-2">
            <Users className="h-4 w-4" /> Crew
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-2">
            <FileText className="h-4 w-4" /> Export Guides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <ImportFlow type="clients" />
        </TabsContent>

        <TabsContent value="crew" className="mt-4">
          <ImportFlow type="crew" />
        </TabsContent>

        <TabsContent value="guide" className="mt-4">
          <ExportGuides />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImportFlow — handles upload → map → preview → done for one type
// ---------------------------------------------------------------------------

function ImportFlow({ type }: { type: ImportType }) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fields = type === "clients" ? CLIENT_FIELDS : CREW_FIELDS;

  const previewClients = trpc.import.previewClients.useMutation();
  const previewCrew = trpc.import.previewCrew.useMutation();
  const importClients = trpc.import.importClients.useMutation();
  const importCrew = trpc.import.importCrew.useMutation();

  const utils = trpc.useUtils();

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please upload a .csv file.");
      return;
    }
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data as CsvRow[];
        if (parsed.length === 0) {
          toast.error("The CSV file appears to be empty.");
          return;
        }
        const hdrs = Object.keys(parsed[0]);
        setRows(parsed);
        setHeaders(hdrs);
        const auto = type === "clients"
          ? autoDetectClientMapping(hdrs)
          : autoDetectCrewMapping(hdrs);
        setMapping(auto);
        setStep("map");
      },
      error: () => toast.error("Failed to parse CSV file."),
    });
  }, [type]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePreview = async () => {
    const nameCol = mapping["name"];
    if (!nameCol) {
      toast.error("You must map the Name column.");
      return;
    }
    try {
      if (type === "clients") {
        await previewClients.mutateAsync({ rows, mapping: buildClientMapping(mapping) });
      } else {
        await previewCrew.mutateAsync({ rows, mapping: buildCrewMapping(mapping) });
      }
      setStep("preview");
    } catch {
      toast.error("Failed to generate preview.");
    }
  };

  const handleImport = async () => {
    try {
      let res;
      if (type === "clients") {
        res = await importClients.mutateAsync({ rows, mapping: buildClientMapping(mapping) });
        utils.clients.list.invalidate();
      } else {
        res = await importCrew.mutateAsync({ rows, mapping: buildCrewMapping(mapping) });
        utils.crew.list.invalidate();
      }
      setResult(res);
      setStep("done");
    } catch {
      toast.error("Import failed. Please try again.");
    }
  };

  const reset = () => {
    setStep("upload");
    setRows([]);
    setHeaders([]);
    setMapping({});
    setResult(null);
  };

  const previewData =
    type === "clients"
      ? previewClients.data?.preview ?? []
      : previewCrew.data?.preview ?? [];

  const isLoading =
    previewClients.isPending || previewCrew.isPending ||
    importClients.isPending || importCrew.isPending;

  return (
    <div>
      <StepIndicator step={step} />

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium">Drop your CSV file here, or click to browse</p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports CSV exports from Jobber, QuickBooks, or any spreadsheet app
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Not sure about the format?
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadSample(type)}
              className="gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Download Sample CSV
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Map Columns ── */}
      {step === "map" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Map your CSV columns</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {rows.length} rows detected. Match each field to a column in your file.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="h-4 w-4 mr-1" /> Start over
            </Button>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="pt-5 space-y-3">
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <p className="text-sm font-medium">
                      {field.label}
                      {"required" in field && field.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </p>
                  </div>
                  <Select
                    value={mapping[field.key] ?? "__none__"}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [field.key]: v === "__none__" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border text-sm">
                      <SelectValue placeholder="— skip —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— skip —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={reset}>Back</Button>
            <Button onClick={handlePreview} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Preview Import
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === "preview" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Preview (first 10 rows)</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {rows.length} total rows will be imported.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep("map")}>
              <X className="h-4 w-4 mr-1" /> Edit mapping
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {fields
                    .filter((f) => mapping[f.key])
                    .map((f) => (
                      <th key={f.key} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    {fields
                      .filter((f) => mapping[f.key])
                      .map((f) => (
                        <td key={f.key} className="px-4 py-2.5 text-foreground/80 whitespace-nowrap max-w-[200px] truncate">
                          {(row as any)[f.key] || <span className="text-muted-foreground/40">—</span>}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
            <Button onClick={handleImport} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import {rows.length} {type === "clients" ? "Clients" : "Crew Members"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === "done" && result && (
        <div className="space-y-5">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Import Complete</h2>
            <p className="text-muted-foreground mt-1">
              Successfully imported {result.imported} {type === "clients" ? "client" : "crew member"}{result.imported !== 1 ? "s" : ""}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{result.imported}</p>
              <p className="text-xs text-muted-foreground mt-1">Imported</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{result.skipped}</p>
              <p className="text-xs text-muted-foreground mt-1">Skipped (empty name)</p>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{result.errors.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-medium text-destructive">Import errors</p>
              </div>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">{e}</p>
              ))}
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={reset}>Import Another File</Button>
            <Button onClick={() => window.location.href = type === "clients" ? "/clients" : "/crew"}>
              View {type === "clients" ? "Clients" : "Crew"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export Guides
// ---------------------------------------------------------------------------

function ExportGuides() {
  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className="bg-orange-500/15 text-orange-400 border-0">Jobber</Badge>
            Exporting from Jobber
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Follow these steps to export your client list from Jobber:</p>
          <ol className="space-y-2 list-none">
            {[
              "Log in to your Jobber account at app.getjobber.com",
              'Navigate to Clients in the left sidebar',
              'Click the "Export" button (top right of the client list)',
              'Select "Export to CSV" and download the file',
              'Come back here, click the Clients tab above, and upload the file',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="p-3 bg-muted/50 rounded-lg border border-border mt-2">
            <p className="text-xs font-medium text-foreground mb-1">Jobber column names auto-detected:</p>
            <p className="text-xs font-mono">Name, Phone, Email, Billing Street, Billing City, Billing State, Billing Zip</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className="bg-green-500/15 text-green-400 border-0">QuickBooks</Badge>
            Exporting from QuickBooks Online
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Follow these steps to export your customer list from QuickBooks Online:</p>
          <ol className="space-y-2 list-none">
            {[
              "Log in to QuickBooks Online",
              'Go to Sales → Customers',
              'Click the gear icon (⚙) in the top right of the customer table',
              'Click "Export to Excel" — this downloads a CSV-compatible file',
              'Open the file in Excel or Google Sheets, save as CSV if needed',
              'Upload the CSV here using the Clients tab above',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-green-500/15 text-green-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="p-3 bg-muted/50 rounded-lg border border-border mt-2">
            <p className="text-xs font-medium text-foreground mb-1">QuickBooks column names auto-detected:</p>
            <p className="text-xs font-mono">Customer Name, Phone, Email, Billing Street, Billing City, Billing State, Billing Zip</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge className="bg-blue-500/15 text-blue-400 border-0">Any Spreadsheet</Badge>
            Using Google Sheets or Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            You can import from any spreadsheet. The column mapper lets you match any column name to the right field — so your headers don't need to match exactly.
          </p>
          <p>
            For best results, download the sample CSV template, fill it in, and upload it directly.
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" size="sm" onClick={() => downloadSample("clients")} className="gap-2">
              <Download className="h-3.5 w-3.5" /> Client Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadSample("crew")} className="gap-2">
              <Download className="h-3.5 w-3.5" /> Crew Template
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mapping builders
// ---------------------------------------------------------------------------

function buildClientMapping(m: Record<string, string>) {
  return {
    name: m.name || "name",
    phone: m.phone || undefined,
    email: m.email || undefined,
    addressLine1: m.addressLine1 || undefined,
    addressLine2: m.addressLine2 || undefined,
    city: m.city || undefined,
    state: m.state || undefined,
    zip: m.zip || undefined,
    notes: m.notes || undefined,
  };
}

function buildCrewMapping(m: Record<string, string>) {
  return {
    name: m.name || "name",
    phone: m.phone || undefined,
    email: m.email || undefined,
    role: m.role || undefined,
  };
}
