import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getInitials } from "@/lib/utils";
import {
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  UserCircle2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useRef } from "react";

// ─── Preset tag colors ────────────────────────────────────────────────────────
const PRESET_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#64748b", // slate
];

type ClientForm = {
  name: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
};

const emptyForm: ClientForm = {
  name: "", phone: "", email: "", addressLine1: "", addressLine2: "",
  city: "", state: "", zip: "", notes: "",
};

// ─── Small inline tag chip component ─────────────────────────────────────────
function TagChip({
  name,
  color,
  onRemove,
}: {
  name: string;
  color: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${color}22`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:opacity-70"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

// ─── Tag manager sub-component inside the dialog ─────────────────────────────
function ClientTagManager({ clientId }: { clientId: number | null }) {
  const utils = trpc.useUtils();
  const { data: allTags } = trpc.tags.list.useQuery();
  const { data: clientTags } = trpc.tags.getForClient.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId }
  );
  const addTag = trpc.tags.addToClient.useMutation({
    onSuccess: () => utils.tags.getForClient.invalidate({ clientId: clientId! }),
  });
  const removeTag = trpc.tags.removeFromClient.useMutation({
    onSuccess: () => utils.tags.getForClient.invalidate({ clientId: clientId! }),
  });

  const clientTagIds = new Set(clientTags?.map((t) => t.id) ?? []);
  const unassigned = (allTags ?? []).filter((t) => !clientTagIds.has(t.id));

  if (!clientId) return null;

  return (
    <div className="space-y-2">
      {/* Current tags */}
      {clientTags && clientTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {clientTags.map((tag) => (
            <TagChip
              key={tag.id}
              name={tag.name}
              color={tag.color}
              onRemove={() => removeTag.mutate({ clientId: clientId!, tagId: tag.id })}
            />
          ))}
        </div>
      )}
      {/* Add tag dropdown */}
      {unassigned.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unassigned.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addTag.mutate({ clientId: clientId!, tagId: tag.id })}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary/50 transition-colors"
            >
              <Plus className="h-2.5 w-2.5" />
              {tag.name}
            </button>
          ))}
        </div>
      )}
      {(allTags ?? []).length === 0 && (
        <p className="text-xs text-muted-foreground">No tags created yet. Create tags in the tag manager above.</p>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Tag manager state
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

  const utils = trpc.useUtils();

  const { data: clients, isLoading } = trpc.clients.list.useQuery();
  const { data: allTags } = trpc.tags.list.useQuery();
  const { data: tagFilteredClients } = trpc.tags.getClientsByTag.useQuery(
    { tagId: activeTagFilter! },
    { enabled: activeTagFilter !== null }
  );

  const createClient = trpc.clients.create.useMutation();
  const updateClient = trpc.clients.update.useMutation();
  const deleteClient = trpc.clients.delete.useMutation();
  const createTag = trpc.tags.create.useMutation({
    onSuccess: () => {
      utils.tags.list.invalidate();
      setNewTagName("");
    },
  });
  const deleteTag = trpc.tags.delete.useMutation({
    onSuccess: () => utils.tags.list.invalidate(),
  });

  // Fetch tags for all visible clients (for display on cards)
  // We'll use a per-client query approach via a helper component

  const tagFilteredIds = activeTagFilter !== null
    ? new Set(tagFilteredClients?.map((c) => c.id) ?? [])
    : null;

  const filtered = (clients ?? []).filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search);
    const matchesTag = tagFilteredIds === null || tagFilteredIds.has(c.id);
    return matchesSearch && matchesTag;
  });

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  type ClientItem = NonNullable<typeof clients>[number];
  const openEdit = (c: ClientItem) => {
    if (!c) return;
    setForm({
      name: c.name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      addressLine1: c.addressLine1 ?? "",
      addressLine2: c.addressLine2 ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      zip: c.zip ?? "",
      notes: c.notes ?? "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    try {
      if (editingId) {
        await updateClient.mutateAsync({ id: editingId, ...form });
        toast.success("Client updated.");
      } else {
        await createClient.mutateAsync(form);
        toast.success("Client added.");
      }
      utils.clients.list.invalidate();
      setShowForm(false);
    } catch {
      toast.error("Failed to save client.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteClient.mutateAsync({ id });
      toast.success("Client removed.");
      utils.clients.list.invalidate();
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete client.");
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor });
  };

  const isPending = createClient.isPending || updateClient.isPending;

  // ─── CSV Import ───────────────────────────────────────────────────────────────
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [csvError, setCsvError] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCsvMutation = trpc.clients.importCsv.useMutation();

  const handleCsvFile = (file: File) => {
    setCsvError("");
    setCsvPreview([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setCsvError("CSV must have a header row and at least one data row."); return; }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      }).filter((r) => r["name"]?.trim());
      if (rows.length === 0) { setCsvError("No valid rows found. Make sure there is a 'name' column."); return; }
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (csvPreview.length === 0) return;
    setCsvImporting(true);
    try {
      const rows = csvPreview.map((r) => ({
        name: r["name"] || r["full name"] || r["client name"] || "",
        phone: r["phone"] || r["phone number"] || r["mobile"] || "",
        email: r["email"] || r["email address"] || "",
        addressLine1: r["addressline1"] || r["address"] || r["address line 1"] || "",
        addressLine2: r["addressline2"] || r["address line 2"] || "",
        city: r["city"] || "",
        state: r["state"] || "",
        zip: r["zip"] || r["postal code"] || r["zipcode"] || "",
        notes: r["notes"] || r["note"] || "",
      })).filter((r) => r.name.trim());
      const result = await importCsvMutation.mutateAsync({ rows });
      utils.clients.list.invalidate();
      toast.success(`Imported ${result.imported} client${result.imported !== 1 ? "s" : ""}${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.`);
      setShowCsvModal(false);
      setCsvPreview([]);
    } catch {
      toast.error("Import failed. Please check your CSV and try again.");
    } finally {
      setCsvImporting(false);
    }
  };

  const downloadSampleCsv = () => {
    const header = "name,phone,email,addressLine1,addressLine2,city,state,zip,notes";
    const sample = "John Smith,555-123-4567,john@example.com,123 Main St,,Ponte Vedra Beach,FL,32082,";
    const blob = new Blob([header + "\n" + sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "clients-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? "Loading…" : `${clients?.length ?? 0} total clients`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTagManager((v) => !v)}
            className="border-border"
          >
            <Tag className="h-4 w-4 mr-1.5" />
            Tags
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCsvModal(true)} className="border-border">
            <Upload className="h-4 w-4 mr-1.5" />
            Import CSV
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Tag Manager Panel */}
      {showTagManager && (
        <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold">Manage Tags</p>

          {/* Existing tags */}
          <div className="flex flex-wrap gap-2">
            {(allTags ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">No tags yet. Create your first tag below.</p>
            )}
            {(allTags ?? []).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}22`,
                  color: tag.color,
                  border: `1px solid ${tag.color}55`,
                }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => deleteTag.mutate({ id: tag.id })}
                  className="hover:opacity-60 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Create new tag */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Tag name…"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
              className="bg-input border-border h-8 text-sm flex-1 max-w-[200px]"
            />
            {/* Color swatches */}
            <div className="flex gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className="h-5 w-5 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: newTagColor === c ? "white" : "transparent",
                    outline: newTagColor === c ? `2px solid ${c}` : "none",
                  }}
                />
              ))}
            </div>
            <Button
              size="sm"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || createTag.isPending}
              className="h-8"
            >
              {createTag.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}

      {/* Tag filter bar */}
      {(allTags ?? []).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Filter:</span>
          <button
            onClick={() => setActiveTagFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              activeTagFilter === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            All
          </button>
          {(allTags ?? []).map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={
                activeTagFilter === tag.id
                  ? {
                      backgroundColor: `${tag.color}33`,
                      color: tag.color,
                      borderColor: tag.color,
                    }
                  : {}
              }
              data-inactive={activeTagFilter !== tag.id || undefined}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-input border-border"
        />
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">
            {search || activeTagFilter ? "No clients match your filters" : "No clients yet"}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add your first client
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={() => openEdit(client)}
              onDelete={() => setDeleteConfirm(client.id)}
              onClick={() => setLocation(`/clients/${client.id}`)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => !v && setShowForm(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-input border-border" placeholder="Jane Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="bg-input border-border" placeholder="(555) 000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-input border-border" placeholder="jane@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address Line 1</Label>
              <AddressAutocomplete
                value={form.addressLine1}
                onChange={(v) => setForm((f) => ({ ...f, addressLine1: v }))}
                onPlaceSelect={({ street, city, state, zip }) => {
                  setForm((f) => ({
                    ...f,
                    addressLine1: street || f.addressLine1,
                    city: city || f.city,
                    state: state || f.state,
                    zip: zip || f.zip,
                  }));
                }}
                placeholder="123 Main St"
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address Line 2</Label>
              <Input value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} className="bg-input border-border" placeholder="Apt 4B" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="bg-input border-border" placeholder="Austin" />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className="bg-input border-border" placeholder="TX" />
              </div>
              <div className="space-y-1.5">
                <Label>ZIP</Label>
                <Input value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} className="bg-input border-border" placeholder="78701" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="bg-input border-border resize-none" rows={3} placeholder="Internal notes about this client…" />
            </div>

            {/* Tags — only shown when editing an existing client */}
            {editingId && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  Tags
                </Label>
                <ClientTagManager clientId={editingId} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Delete Client?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove <strong>the client and all related data</strong> — including jobs, addresses, communications, follow-ups, projects, and credentials. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={deleteClient.isPending}>
              {deleteClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       {/* CSV Import Modal */}
      <Dialog open={showCsvModal} onOpenChange={(v) => { if (!v) { setShowCsvModal(false); setCsvPreview([]); setCsvError(""); } }}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Import Clients from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f); }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Click to select a CSV file or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">Columns: name, phone, email, addressLine1, city, state, zip, notes</p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
            </div>
            {/* Sample download */}
            <button type="button" onClick={downloadSampleCsv} className="text-xs text-primary underline underline-offset-2 hover:opacity-70">
              Download sample CSV template
            </button>
            {/* Error */}
            {csvError && <p className="text-sm text-destructive">{csvError}</p>}
            {/* Preview table */}
            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{csvPreview.length} client{csvPreview.length !== 1 ? "s" : ""} ready to import</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Phone</th>
                        <th className="text-left p-2 font-medium">Email</th>
                        <th className="text-left p-2 font-medium">City</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-2">{row["name"] || "—"}</td>
                          <td className="p-2 text-muted-foreground">{row["phone"] || "—"}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[140px]">{row["email"] || "—"}</td>
                          <td className="p-2 text-muted-foreground">{row["city"] || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCsvModal(false); setCsvPreview([]); setCsvError(""); }}>Cancel</Button>
            <Button onClick={handleCsvImport} disabled={csvPreview.length === 0 || csvImporting}>
              {csvImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {csvPreview.length > 0 ? `${csvPreview.length} Client${csvPreview.length !== 1 ? "s" : ""}` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ─── Client Card with lazy-loaded tags ───────────────────────────────────────
function ClientCard({
  client,
  onEdit,
  onDelete,
  onClick,
}: {
  client: { id: number; name: string; phone?: string | null; email?: string | null; addressLine1?: string | null; city?: string | null; state?: string | null };
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const { data: tags } = trpc.tags.getForClient.useQuery({ clientId: client.id });

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-all group cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border border-border shrink-0">
          <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
            {getInitials(client.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {client.name}
            </p>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg hover:bg-destructive/15 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          </div>
          <div className="space-y-0.5 mt-1">
            {client.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
            {(client.city || client.addressLine1) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {[client.addressLine1, client.city, client.state].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>
          {/* Tag chips */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} color={tag.color} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
