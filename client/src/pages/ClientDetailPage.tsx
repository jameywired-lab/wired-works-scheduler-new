import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  formatDate,
  formatTime,
  getInitials,
  statusClass,
  statusLabel,
  type JobStatus,
} from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FolderOpen,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  FileText,
  ImageIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { KeyRound, Eye, EyeOff, X, Send, Link, MessageSquare } from "lucide-react";
import JobFormModal from "@/components/JobFormModal";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const ADDRESS_LABELS = ["Home", "Business", "Vacation", "Other"];

interface AddressFormState {
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  isPrimary: boolean;
}

const emptyAddressForm = (): AddressFormState => ({
  label: "Home",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  isPrimary: false,
});

function buildAddressString(addr: {
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  return [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.zip]
    .filter(Boolean)
    .join(", ");
}

function openDirections(address: string) {
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
    "_blank"
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [, setLocation] = useLocation();
  const [showJobForm, setShowJobForm] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm());
  const utils = trpc.useUtils();

  const { data: client, isLoading: clientLoading } = trpc.clients.getById.useQuery({ id: clientId });
  const { data: allJobs, isLoading: jobsLoading } = trpc.jobs.list.useQuery();
  const { data: clientProjects = [], isLoading: projectsLoading } = trpc.projects.listByClient.useQuery(
    { clientId },
    { enabled: !!clientId }
  );
  const { data: addresses, isLoading: addressesLoading } = trpc.clientAddresses.getByClient.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  const createAddress = trpc.clientAddresses.create.useMutation({
    onSuccess: () => {
      utils.clientAddresses.getByClient.invalidate({ clientId });
      setShowAddressModal(false);
      toast.success("Address added.");
    },
    onError: () => toast.error("Failed to add address."),
  });

  const updateAddress = trpc.clientAddresses.update.useMutation({
    onSuccess: () => {
      utils.clientAddresses.getByClient.invalidate({ clientId });
      setShowAddressModal(false);
      toast.success("Address updated.");
    },
    onError: () => toast.error("Failed to update address."),
  });

  const deleteAddress = trpc.clientAddresses.delete.useMutation({
    onSuccess: () => {
      utils.clientAddresses.getByClient.invalidate({ clientId });
      toast.success("Address removed.");
    },
    onError: () => toast.error("Failed to delete address."),
  });

  const clientJobs = (allJobs ?? []).filter((j) => j.clientId === clientId);

  const openNewAddress = () => {
    setEditingAddressId(null);
    setAddressForm(emptyAddressForm());
    setShowAddressModal(true);
  };

  const openEditAddress = (addr: NonNullable<typeof addresses>[number]) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 ?? "",
      city: addr.city ?? "",
      state: addr.state ?? "",
      zip: addr.zip ?? "",
      isPrimary: addr.isPrimary,
    });
    setShowAddressModal(true);
  };

  const handleAddressSave = async () => {
    if (!addressForm.addressLine1.trim()) {
      toast.error("Address line 1 is required.");
      return;
    }
    if (editingAddressId !== null) {
      await updateAddress.mutateAsync({
        id: editingAddressId,
        clientId,
        ...addressForm,
      });
    } else {
      await createAddress.mutateAsync({
        clientId,
        ...addressForm,
      });
    }
  };

  if (clientLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Client not found.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setLocation("/clients")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Clients
        </Button>
      </div>
    );
  }

  const isSaving = createAddress.isPending || updateAddress.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/clients")} className="h-8 px-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border border-border">
            <AvatarFallback className="bg-primary/15 text-primary text-lg font-bold">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {clientJobs.length} job{clientJobs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowJobForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Job
        </Button>
      </div>

      {/* Contact info — phone, email, address all in one card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Contact Information
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openNewAddress}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Address
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.phone && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <a href={`tel:${client.phone}`} className="text-sm font-medium hover:text-primary transition-colors">
                  {client.phone}
                </a>
              </div>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${client.email}`} className="text-sm font-medium hover:text-primary transition-colors">
                  {client.email}
                </a>
              </div>
            </div>
          )}
          {/* Primary address from client record */}
          {client.addressLine1 && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium leading-snug">
                  {[client.addressLine1, client.addressLine2, client.city, client.state, client.zip].filter(Boolean).join(", ")}
                </p>
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
                title="Get directions"
                onClick={() => openDirections([client.addressLine1, client.city, client.state, client.zip].filter(Boolean).join(", "))}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {/* Additional saved addresses */}
          {!addressesLoading && addresses && addresses.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              {addresses.map((addr) => {
                const fullAddr = buildAddressString(addr);
                return (
                  <div key={addr.id} className="flex items-start justify-between gap-3 p-2.5 bg-muted/40 rounded-lg border border-border/50">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold">{addr.label}</span>
                          {addr.isPrimary && (
                            <Badge className="bg-primary/15 text-primary border-0 text-[10px] px-1.5 py-0 rounded-full">
                              <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{fullAddr}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => openDirections(fullAddr)}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => openEditAddress(addr)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteAddress.mutate({ id: addr.id })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {client.notes && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground/80">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials section */}
      <ClientCredentialsSection clientId={clientId} />

      {/* Job history */}
      <div className="space-y-3">
        <h2 className="font-semibold">Job History</h2>
        {jobsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : clientJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-card border border-dashed border-border rounded-xl text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No jobs for this client yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clientJobs
              .sort((a, b) => b.scheduledStart - a.scheduledStart)
              .map((job) => (
                <button
                  key={job.id}
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {job.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(job.scheduledStart)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(job.scheduledStart)}</span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={`${statusClass(job.status as JobStatus)} text-[10px] shrink-0 rounded-full`}
                    >
                      {statusLabel(job.status as JobStatus)}
                    </Badge>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Projects section */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Projects
        </h2>
        {projectsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : clientProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 bg-card border border-dashed border-border rounded-xl text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No projects for this client yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clientProjects.map((proj) => {
              const statusColors: Record<string, string> = {
                active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                on_hold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                completed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                cancelled: "bg-red-500/15 text-red-600 dark:text-red-400",
              };
              const statusLabels: Record<string, string> = {
                active: "Active",
                on_hold: "On Hold",
                completed: "Completed",
                cancelled: "Cancelled",
              };
              const typeLabels: Record<string, string> = {
                new_construction: "New Construction",
                commercial: "Commercial",
                retrofit: "Retrofit",
              };
              return (
                <button
                  key={proj.id}
                  onClick={() => setLocation(`/projects?project=${proj.id}`)}
                  className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {proj.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {proj.projectType && (
                          <span className="text-xs text-muted-foreground">{typeLabels[proj.projectType] ?? proj.projectType}</span>
                        )}
                        {proj.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Due {new Date(proj.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                        )}
                        {proj.projectValue && (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            ${parseFloat(String(proj.projectValue)).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={`${statusColors[proj.status] ?? ""} text-[10px] shrink-0 rounded-full`}>
                      {statusLabels[proj.status] ?? proj.status}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Communications section */}
      <ClientCommunicationsSection clientId={clientId} clientName={client.name} clientPhone={client.phone ?? undefined} />

      {/* Notes & Photos section */}
      <ClientNotesAndPhotos clientId={clientId} />

      {/* Address modal */}
      <Dialog open={showAddressModal} onOpenChange={(v) => !v && setShowAddressModal(false)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingAddressId ? "Edit Address" : "Add Address"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Label */}
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Select
                value={addressForm.label}
                onValueChange={(v) => setAddressForm((f) => ({ ...f, label: v }))}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_LABELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Address Line 1 — Google Maps autocomplete */}
            <div className="space-y-1.5">
              <Label>Address Line 1 *</Label>
              <AddressAutocomplete
                value={addressForm.addressLine1}
                onChange={(v) => setAddressForm((f) => ({ ...f, addressLine1: v }))}
                onPlaceSelect={({ street, city, state, zip }) => {
                  setAddressForm((f) => ({
                    ...f,
                    addressLine1: street,
                    city: city || f.city,
                    state: state || f.state,
                    zip: zip || f.zip,
                  }));
                }}
                placeholder="123 Main St"
                className="bg-input border-border"
              />
            </div>

            {/* Address Line 2 */}
            <div className="space-y-1.5">
              <Label>Address Line 2</Label>
              <Input
                placeholder="Suite 100, Unit B, etc."
                value={addressForm.addressLine2}
                onChange={(e) => setAddressForm((f) => ({ ...f, addressLine2: e.target.value }))}
                className="bg-input border-border"
              />
            </div>

            {/* City / State / Zip */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5">
                <Label>City</Label>
                <Input
                  placeholder="Jacksonville"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input
                  placeholder="FL"
                  value={addressForm.state}
                  onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Zip</Label>
                <Input
                  placeholder="32202"
                  value={addressForm.zip}
                  onChange={(e) => setAddressForm((f) => ({ ...f, zip: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
            </div>

            {/* Primary toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">Set as primary address</p>
                <p className="text-xs text-muted-foreground">Auto-selected when creating jobs</p>
              </div>
              <Switch
                checked={addressForm.isPrimary}
                onCheckedChange={(v) => setAddressForm((f) => ({ ...f, isPrimary: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddressModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleAddressSave} disabled={isSaving}>
              {isSaving ? "Saving…" : editingAddressId ? "Save Changes" : "Add Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showJobForm && (
        <JobFormModal
          open={showJobForm}
          onClose={() => setShowJobForm(false)}
          onSuccess={() => {
            setShowJobForm(false);
            utils.jobs.list.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ─── Client Credentials Section ──────────────────────────────────────────────
function ClientCredentialsSection({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const { data: creds, isLoading } = trpc.clientCredentials.list.useQuery({ clientId });
  const upsert = trpc.clientCredentials.upsert.useMutation({
    onSuccess: () => utils.clientCredentials.list.invalidate({ clientId }),
  });
  const add = trpc.clientCredentials.add.useMutation({
    onSuccess: () => {
      utils.clientCredentials.list.invalidate({ clientId });
      setNewLabel("");
      setNewValue("");
    },
  });
  const del = trpc.clientCredentials.delete.useMutation({
    onSuccess: () => utils.clientCredentials.list.invalidate({ clientId }),
  });
  const seed = trpc.clientCredentials.seed.useMutation({
    onSuccess: () => utils.clientCredentials.list.invalidate({ clientId }),
  });

  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [editingVal, setEditingVal] = useState<Record<number, string>>({});
  const [editingLabel, setEditingLabel] = useState<Record<number, string>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const toggleShow = (id: number) => setShown((s) => ({ ...s, [id]: !s[id] }));

  const handleValueBlur = (id: number, key: string, label: string, val: string) => {
    upsert.mutate({ clientId, key, label, value: val });
  };

  const handleLabelBlur = (id: number, key: string, newLabelVal: string, currentVal: string) => {
    if (!newLabelVal.trim()) return;
    upsert.mutate({ clientId, key, label: newLabelVal.trim(), value: currentVal });
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    add.mutate({ clientId, label: newLabel.trim(), value: newValue });
  };

  const isSensitive = (label: string) =>
    /password|pin|code|pass|secret|key|token/i.test(label);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Credentials
          </CardTitle>
          {(!creds || creds.length === 0) && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => seed.mutate({ clientId })}
              disabled={seed.isPending}
            >
              Seed Defaults
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
          </div>
        ) : (
          <>
            {(creds ?? []).map((c) => {
              const sensitive = isSensitive(c.label);
              const isVisible = shown[c.id] || !sensitive;
              const editVal = editingVal[c.id] ?? c.value ?? "";
              const editLbl = editingLabel[c.id] ?? c.label ?? "";
              return (
                <div key={c.id} className="flex items-center gap-2 group">
                  <div className="w-36 shrink-0">
                    <Input
                      value={editLbl}
                      onChange={(e) =>
                        setEditingLabel((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      onBlur={() => handleLabelBlur(c.id, c.key, editLbl, editVal)}
                      className="h-8 text-xs font-medium bg-muted/50 border-border"
                      placeholder="Label"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <Input
                      type={sensitive && !isVisible ? "password" : "text"}
                      value={editVal}
                      onChange={(e) =>
                        setEditingVal((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      onBlur={() => handleValueBlur(c.id, c.key, editLbl, editVal)}
                      className="h-8 text-sm bg-input border-border pr-8"
                      placeholder="—"
                    />
                    {sensitive && (
                      <button
                        type="button"
                        onClick={() => toggleShow(c.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => del.mutate({ id: c.id })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Add new credential row */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Input
                placeholder="Label (e.g. Wi-Fi Password)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-8 text-sm bg-input border-border w-40 shrink-0"
              />
              <Input
                placeholder="Value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="h-8 text-sm bg-input border-border flex-1"
              />
              <Button
                size="sm"
                className="h-8 text-xs shrink-0"
                onClick={handleAdd}
                disabled={!newLabel.trim() || add.isPending}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Client Communications Section ───────────────────────────────────────────
function ClientCommunicationsSection({ clientId, clientName, clientPhone }: { clientId: number; clientName: string; clientPhone?: string }) {
  const utils = trpc.useUtils();
  const { data: comms, isLoading } = trpc.communications.list.useQuery({ clientId });

  const [channel, setChannel] = useState<"sms" | "email" | "call" | "note">("note");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showForm, setShowForm] = useState(false);
  // New outbound SMS composer
  const [showSmsComposer, setShowSmsComposer] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [smsMediaUrls, setSmsMediaUrls] = useState<string[]>([]);
  const [smsLinkInput, setSmsLinkInput] = useState("");
  const [showSmsLinkInput, setShowSmsLinkInput] = useState(false);
  const [uploadingSmsMedia, setUploadingSmsMedia] = useState(false);

  const addNote = trpc.communications.addNote.useMutation({
    onSuccess: () => {
      utils.communications.list.invalidate({ clientId });
      setBody("");
      setSubject("");
      setShowForm(false);
      toast.success("Communication logged");
    },
    onError: () => toast.error("Failed to log communication"),
  });

  const deleteComm = trpc.communications.delete.useMutation({
    onSuccess: () => utils.communications.list.invalidate({ clientId }),
  });

  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyMediaUrls, setReplyMediaUrls] = useState<string[]>([]);
  const [replyLinkInput, setReplyLinkInput] = useState("");
  const [showReplyLinkInput, setShowReplyLinkInput] = useState(false);
  const [uploadingReplyMedia, setUploadingReplyMedia] = useState(false);

  const uploadMedia = trpc.communications.uploadMedia.useMutation();

  const sendSms = trpc.communications.sendSms.useMutation({
    onSuccess: () => {
      utils.communications.list.invalidate({ clientId });
      toast.success("Message sent");
      setReplyText("");
      setReplyMediaUrls([]);
      setReplyToId(null);
      setSmsText("");
      setSmsMediaUrls([]);
      setShowSmsComposer(false);
    },
    onError: (err) => toast.error(err.message ?? "Failed to send"),
  });

  async function handleSmsMediaUpload(e: React.ChangeEvent<HTMLInputElement>, target: "reply" | "new") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5 MB)"); return; }
    if (target === "reply") setUploadingReplyMedia(true); else setUploadingSmsMedia(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadMedia.mutateAsync({ fileBase64: base64, mimeType: file.type, fileName: file.name });
        if (target === "reply") setReplyMediaUrls(prev => [...prev, result.url]);
        else setSmsMediaUrls(prev => [...prev, result.url]);
        toast.success("Photo attached");
      };
      reader.readAsDataURL(file);
    } finally {
      if (target === "reply") setUploadingReplyMedia(false); else setUploadingSmsMedia(false);
    }
  }

  function handleAddLink(target: "reply" | "new") {
    const raw = target === "reply" ? replyLinkInput : smsLinkInput;
    if (!raw.trim()) return;
    const url = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
    if (target === "reply") { setReplyMediaUrls(prev => [...prev, url]); setReplyLinkInput(""); setShowReplyLinkInput(false); }
    else { setSmsMediaUrls(prev => [...prev, url]); setSmsLinkInput(""); setShowSmsLinkInput(false); }
  }

  const channelIcon = (ch: string) => {
    if (ch === "sms") return "💬";
    if (ch === "email") return "📧";
    if (ch === "call") return "📞";
    return "📝";
  };

  const channelColor = (ch: string, dir: string) => {
    if (dir === "inbound") return "border-l-blue-500";
    if (ch === "sms") return "border-l-green-500";
    if (ch === "email") return "border-l-purple-500";
    if (ch === "call") return "border-l-amber-500";
    return "border-l-muted-foreground";
  };

  // Auto-scroll + open SMS composer when navigated from Follow-Ups with ?tab=communications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "communications") {
      setTimeout(() => {
        const el = document.getElementById("communications-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        if (clientPhone) setShowSmsComposer(true);
      }, 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientPhone]);

  return (
    <Card id="communications-section" className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Communications
          </CardTitle>
          <div className="flex gap-1">
            {clientPhone && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-teal-600/50 text-teal-400 hover:bg-teal-950/50" onClick={() => { setShowSmsComposer(!showSmsComposer); setShowForm(false); }}>
                <MessageSquare className="h-3 w-3" /> Text
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setShowForm(!showForm); setShowSmsComposer(false); }}>
              <Plus className="h-3 w-3" /> Log
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* New outbound SMS composer */}
        {showSmsComposer && clientPhone && (
          <div className="space-y-2 p-3 rounded-lg border border-teal-500/40 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs text-teal-700 font-medium">Send text to {clientName}</span>
              <button onClick={() => { setShowSmsComposer(false); setSmsMediaUrls([]); }} className="text-zinc-500 hover:text-zinc-300"><X className="h-3.5 w-3.5" /></button>
            </div>
            <Textarea
              placeholder="Type your message…"
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              className="min-h-[70px] text-sm text-gray-900 bg-white border-gray-300 resize-none placeholder:text-gray-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && (smsText.trim() || smsMediaUrls.length > 0)) {
                  sendSms.mutate({ to: clientPhone, body: smsText.trim() || " ", clientId, mediaUrls: smsMediaUrls.length > 0 ? smsMediaUrls : undefined });
                }
              }}
            />
            {smsMediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {smsMediaUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-1 text-xs text-zinc-300">
                    {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <img src={url} alt="" className="h-8 w-8 object-cover rounded" /> : <Link className="h-3 w-3 text-blue-400" />}
                    <span className="max-w-[120px] truncate">{url.split("/").pop()}</span>
                    <button onClick={() => setSmsMediaUrls(prev => prev.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400 ml-1"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {showSmsLinkInput && (
              <div className="flex gap-2">
                <Input placeholder="Paste a URL…" value={smsLinkInput} onChange={(e) => setSmsLinkInput(e.target.value)} className="h-7 text-xs text-gray-900 bg-white border-gray-300 placeholder:text-gray-400" onKeyDown={(e) => { if (e.key === "Enter") handleAddLink("new"); }} />
                <Button size="sm" className="h-7 text-xs" onClick={() => handleAddLink("new")}>Add</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowSmsLinkInput(false)}>Cancel</Button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleSmsMediaUpload(e, "new")} disabled={uploadingSmsMedia} />
                  <span className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded border border-zinc-600/50 text-zinc-400 hover:bg-zinc-800 cursor-pointer">
                    <ImageIcon className="h-3 w-3" />{uploadingSmsMedia ? "Uploading…" : "Photo"}
                  </span>
                </label>
                <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-600/50 text-zinc-400" onClick={() => setShowSmsLinkInput(!showSmsLinkInput)}>
                  <Link className="h-3 w-3 mr-1" />Link
                </Button>
              </div>
              <Button
                size="sm"
                className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                disabled={(!smsText.trim() && smsMediaUrls.length === 0) || sendSms.isPending}
                onClick={() => sendSms.mutate({ to: clientPhone, body: smsText.trim() || " ", clientId, mediaUrls: smsMediaUrls.length > 0 ? smsMediaUrls : undefined })}
              >
                <Send className="h-3 w-3 mr-1" />{sendSms.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                  <SelectTrigger className="h-8 text-xs bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">📝 Note</SelectItem>
                    <SelectItem value="sms">💬 SMS</SelectItem>
                    <SelectItem value="email">📧 Email</SelectItem>
                    <SelectItem value="call">📞 Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Direction</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
                  <SelectTrigger className="h-8 text-xs bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">↗ Outbound</SelectItem>
                    <SelectItem value="inbound">↙ Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {channel === "email" && (
              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-8 text-xs bg-input border-border"
              />
            )}
            <textarea
              placeholder={`Log ${channel === "note" ? "a note" : `this ${channel}`}…`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full min-h-[80px] text-sm bg-input border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!body.trim() || addNote.isPending}
                onClick={() => addNote.mutate({ clientId, channel, direction, subject: subject || undefined, body })}
              >
                {addNote.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : !comms || comms.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No communications logged yet. Click "Log" to add one.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {comms.map((c) => (
              <React.Fragment key={c.id}>
              <div
                className={`flex gap-3 p-2.5 rounded-lg border border-border border-l-4 ${channelColor(c.channel, c.direction)} bg-muted/10`}
              >
                <span className="text-base shrink-0 mt-0.5">{channelIcon(c.channel)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium capitalize">
                      {c.direction === "inbound" ? "↙ Inbound" : "↗ Outbound"} {c.channel}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {c.subject && <p className="text-xs font-medium text-foreground/80 mb-0.5">{c.subject}</p>}
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{c.body}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                  {c.channel === "sms" && clientPhone && (
                    <button
                      type="button"
                      onClick={() => { setReplyToId(replyToId === c.id ? null : c.id); setReplyText(""); }}
                      className="text-teal-500 hover:text-teal-300 transition-colors"
                      title="Reply"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteComm.mutate({ id: c.id })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {/* Inline reply composer for this message */}
              {replyToId === c.id && clientPhone && (
                <div className="mt-2 ml-7 border border-teal-500/40 rounded-md p-2.5 bg-white space-y-2">
                  <Textarea
                    placeholder={`Reply to ${clientName}…`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-[60px] text-xs text-gray-900 bg-white border-gray-300 resize-none placeholder:text-gray-400"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && (replyText.trim() || replyMediaUrls.length > 0)) {
                        sendSms.mutate({ to: clientPhone, body: replyText.trim() || " ", clientId, mediaUrls: replyMediaUrls.length > 0 ? replyMediaUrls : undefined });
                      }
                    }}
                  />
                  {replyMediaUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {replyMediaUrls.map((url, i) => (
                        <div key={i} className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-1 text-xs text-zinc-300">
                          {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <img src={url} alt="" className="h-8 w-8 object-cover rounded" /> : <Link className="h-3 w-3 text-blue-400" />}
                          <span className="max-w-[100px] truncate">{url.split("/").pop()}</span>
                          <button onClick={() => setReplyMediaUrls(prev => prev.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400 ml-1"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showReplyLinkInput && (
                    <div className="flex gap-2">
                      <Input placeholder="Paste a URL…" value={replyLinkInput} onChange={(e) => setReplyLinkInput(e.target.value)} className="h-7 text-xs text-gray-900 bg-white border-gray-300 placeholder:text-gray-400" onKeyDown={(e) => { if (e.key === "Enter") handleAddLink("reply"); }} />
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleAddLink("reply")}>Add</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowReplyLinkInput(false)}>Cancel</Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleSmsMediaUpload(e, "reply")} disabled={uploadingReplyMedia} />
                        <span className="inline-flex items-center gap-1 h-6 px-2 text-xs rounded border border-zinc-600/50 text-zinc-400 hover:bg-zinc-800 cursor-pointer">
                          <ImageIcon className="h-3 w-3" />{uploadingReplyMedia ? "Uploading…" : "Photo"}
                        </span>
                      </label>
                      <Button size="sm" variant="outline" className="h-6 text-xs border-zinc-600/50 text-zinc-400" onClick={() => setShowReplyLinkInput(!showReplyLinkInput)}>
                        <Link className="h-3 w-3 mr-1" />Link
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => { setReplyToId(null); setReplyMediaUrls([]); }}>Cancel</Button>
                      <Button
                        size="sm"
                        className="h-6 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                        disabled={(!replyText.trim() && replyMediaUrls.length === 0) || sendSms.isPending}
                        onClick={() => sendSms.mutate({ to: clientPhone, body: replyText.trim() || " ", clientId, mediaUrls: replyMediaUrls.length > 0 ? replyMediaUrls : undefined })}
                      >
                        <Send className="h-3 w-3 mr-1" />{sendSms.isPending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Client Notes & Photos Section ───────────────────────────────────────────
function ClientNotesAndPhotos({ clientId }: { clientId: number }) {
  const [activeTab, setActiveTab] = useState<"notes" | "photos">("notes");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());

  const { data: notes, isLoading: notesLoading } = trpc.crewNotes.getByClient.useQuery({ clientId });
  const { data: photos, isLoading: photosLoading } = trpc.jobPhotos.listByClient.useQuery({ clientId });

  // Group notes by jobId
  const notesByJob = React.useMemo(() => {
    const map = new Map<number, { jobTitle: string; jobDate: number | null; notes: typeof notes }>();
    (notes ?? []).forEach((n) => {
      if (!map.has(n.jobId)) {
        map.set(n.jobId, { jobTitle: n.jobTitle ?? "Untitled Job", jobDate: n.jobScheduledStart ?? null, notes: [] });
      }
      map.get(n.jobId)!.notes!.push(n);
    });
    // Sort jobs newest first
    return Array.from(map.entries()).sort((a, b) => (b[1].jobDate ?? 0) - (a[1].jobDate ?? 0));
  }, [notes]);

  // Group photos by jobId
  const photosByJob = React.useMemo(() => {
    const map = new Map<number, { jobTitle: string; jobDate: number | null; photos: typeof photos }>();
    (photos ?? []).forEach((p) => {
      if (!map.has(p.jobId)) {
        map.set(p.jobId, { jobTitle: p.jobTitle ?? "Untitled Job", jobDate: p.jobScheduledStart ?? null, photos: [] });
      }
      map.get(p.jobId)!.photos!.push(p);
    });
    return Array.from(map.entries()).sort((a, b) => (b[1].jobDate ?? 0) - (a[1].jobDate ?? 0));
  }, [photos]);

  const toggleJob = (jobId: number) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const totalNotes = notes?.length ?? 0;
  const totalPhotos = photos?.length ?? 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Notes &amp; Photos</CardTitle>
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("notes")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === "notes"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <FileText className="h-3 w-3" />
              Notes {totalNotes > 0 && <span className="ml-0.5 opacity-70">({totalNotes})</span>}
            </button>
            <button
              onClick={() => setActiveTab("photos")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === "photos"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ImageIcon className="h-3 w-3" />
              Photos {totalPhotos > 0 && <span className="ml-0.5 opacity-70">({totalPhotos})</span>}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* ── Notes Tab ── */}
        {activeTab === "notes" && (
          <>
            {notesLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : notesByJob.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No crew notes yet for this client.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {notesByJob.map(([jobId, { jobTitle, jobDate, notes: jobNotes }]) => {
                  const isOpen = expandedJobs.has(jobId) || notesByJob.length === 1;
                  return (
                    <div key={jobId} className="border border-border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => toggleJob(jobId)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-medium truncate">{jobTitle}</span>
                          {jobDate && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              · {new Date(jobDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{jobNotes!.length} note{jobNotes!.length !== 1 ? "s" : ""}</span>
                          {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="divide-y divide-border">
                          {jobNotes!.map((note) => (
                            <div key={note.id} className="px-3 py-2.5 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground/80">{note.authorName ?? "Crew Member"}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Photos Tab ── */}
        {activeTab === "photos" && (
          <>
            {photosLoading ? (
              <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}</div>
            ) : photosByJob.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No photos uploaded yet for this client.</p>
            ) : (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {photosByJob.map(([jobId, { jobTitle, jobDate, photos: jobPhotos }]) => (
                  <div key={jobId}>
                    <div className="flex items-center gap-2 mb-2">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{jobTitle}</span>
                      {jobDate && (
                        <span className="text-xs text-muted-foreground">· {new Date(jobDate).toLocaleDateString()}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{jobPhotos!.length} photo{jobPhotos!.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {jobPhotos!.map((photo) => {
                        const displayUrl = photo.annotatedS3Url ?? photo.s3Url;
                        return (
                          <button
                            key={photo.id}
                            onClick={() => setLightboxUrl(displayUrl)}
                            className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors group"
                          >
                            <img
                              src={displayUrl}
                              alt={photo.filename ?? "Job photo"}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            {photo.annotatedS3Url && (
                              <span className="absolute top-1 right-1 bg-primary/80 text-primary-foreground text-[9px] px-1 py-0.5 rounded font-medium">
                                Annotated
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Card>
  );
}
