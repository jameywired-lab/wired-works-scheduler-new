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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
        {isAdmin && (
          <Button size="sm" onClick={() => setShowJobForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Job
          </Button>
        )}
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
            {isAdmin && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openNewAddress}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Address
              </Button>
            )}
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
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-3" onClick={openNewAddress}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add First Address
                </Button>
              )}
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
                      {isAdmin && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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

            {/* Address Line 1 */}
            <div className="space-y-1.5">
              <Label>Address Line 1 *</Label>
              <Input
                placeholder="123 Main St"
                value={addressForm.addressLine1}
                onChange={(e) => setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))}
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
