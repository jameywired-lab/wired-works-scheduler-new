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
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { KeyRound, Eye, EyeOff, X } from "lucide-react";
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

      {/* Contact info */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.phone && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <a
                  href={`tel:${client.phone}`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
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
                <a
                  href={`mailto:${client.email}`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {client.email}
                </a>
              </div>
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

      {/* Addresses section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Addresses
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openNewAddress}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Address
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {addressesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !addresses || addresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No addresses saved yet.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openNewAddress}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add First Address
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => {
                const fullAddr = buildAddressString(addr);
                return (
                  <div
                    key={addr.id}
                    className="flex items-start justify-between gap-3 p-3 bg-muted/40 rounded-lg border border-border/50"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{addr.label}</span>
                          {addr.isPrimary && (
                            <Badge className="bg-primary/15 text-primary border-0 text-[10px] px-1.5 py-0 rounded-full">
                              <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{fullAddr}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Get directions"
                        onClick={() => openDirections(fullAddr)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit address"
                        onClick={() => openEditAddress(addr)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete address"
                        onClick={() => deleteAddress.mutate({ id: addr.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
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

      {/* Communications section */}
      <ClientCommunicationsSection clientId={clientId} clientName={client.name} />

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
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const toggleShow = (id: number) => setShown((s) => ({ ...s, [id]: !s[id] }));

  const handleBlur = (id: number, key: string, label: string, val: string) => {
    upsert.mutate({ clientId, key, label, value: val });
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
              const editVal = editing[c.id] ?? c.value ?? "";
              return (
                <div key={c.id} className="flex items-center gap-2 group">
                  <div className="w-32 shrink-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">{c.label}</p>
                  </div>
                  <div className="flex-1 relative">
                    <Input
                      type={sensitive && !isVisible ? "password" : "text"}
                      value={editVal}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      onBlur={() => handleBlur(c.id, c.key, c.label, editVal)}
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
function ClientCommunicationsSection({ clientId, clientName }: { clientId: number; clientName: string }) {
  const utils = trpc.useUtils();
  const { data: comms, isLoading } = trpc.communications.list.useQuery({ clientId });

  const [channel, setChannel] = useState<"sms" | "email" | "call" | "note">("note");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showForm, setShowForm] = useState(false);

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

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Communications
          </CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3 w-3" /> Log
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
              <div
                key={c.id}
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
                <button
                  type="button"
                  onClick={() => deleteComm.mutate({ id: c.id })}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
