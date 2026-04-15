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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Loader2, MapPin, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface JobFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date;
  jobId?: number; // if provided, edit mode
}

function toLocalDateTimeValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeValue(val: string): number {
  return new Date(val).getTime();
}

function buildAddressString(addr: {
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const parts = [
    addr.addressLine1,
    addr.addressLine2,
    addr.city,
    addr.state,
    addr.zip,
  ].filter(Boolean);
  return parts.join(", ");
}

function openDirections(address: string) {
  const encoded = encodeURIComponent(address);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, "_blank");
}

export default function JobFormModal({ open, onClose, onSuccess, initialDate, jobId }: JobFormModalProps) {
  const isEdit = !!jobId;

  const { data: clients } = trpc.clients.list.useQuery();
  const { data: crewList } = trpc.crew.list.useQuery({ activeOnly: true });
  const { data: existingJob } = trpc.jobs.getById.useQuery(
    { id: jobId! },
    { enabled: isEdit && open }
  );

  const createJob = trpc.jobs.create.useMutation();
  const updateJob = trpc.jobs.update.useMutation();

  const defaultStart = initialDate ?? new Date();
  defaultStart.setMinutes(0, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 2 * 3600_000);

  const [form, setForm] = useState({
    clientId: "",
    title: "",
    description: "",
    address: "",
    selectedAddressId: "custom" as string, // "custom" or address id
    ownerInstructions: "",
    scheduledStart: toLocalDateTimeValue(defaultStart.getTime()),
    scheduledEnd: toLocalDateTimeValue(defaultEnd.getTime()),
    status: "scheduled" as "scheduled" | "in_progress" | "completed" | "cancelled",
    crewMemberIds: [] as number[],
    sendBookingSms: true,
    syncToGoogleCalendar: true,
  });

  // Fetch addresses for selected client
  const { data: clientAddresses } = trpc.clientAddresses.getByClient.useQuery(
    { clientId: Number(form.clientId) },
    { enabled: !!form.clientId && form.clientId !== "" }
  );

  // When client changes or addresses load, auto-select primary address
  useEffect(() => {
    if (!form.clientId || !clientAddresses || clientAddresses.length === 0) return;
    // Only auto-fill if address is currently empty (just selected a new client)
    if (form.address !== "") return;
    const primary = clientAddresses.find((a) => a.isPrimary) ?? clientAddresses[0];
    if (primary) {
      const addrStr = buildAddressString(primary);
      setForm((f) => ({
        ...f,
        selectedAddressId: String(primary.id),
        address: addrStr,
      }));
    }
  }, [clientAddresses, form.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate form in edit mode
  useEffect(() => {
    if (existingJob && isEdit) {
      setForm({
        clientId: String(existingJob.clientId),
        title: existingJob.title,
        description: existingJob.description ?? "",
        address: existingJob.address ?? "",
        selectedAddressId: "custom",
        ownerInstructions: existingJob.ownerInstructions ?? "",
        scheduledStart: toLocalDateTimeValue(existingJob.scheduledStart),
        scheduledEnd: toLocalDateTimeValue(existingJob.scheduledEnd),
        status: existingJob.status as typeof form.status,
        crewMemberIds: existingJob.assignments?.map((a) => a.crewMemberId) ?? [],
        sendBookingSms: false,
        syncToGoogleCalendar: true,
      });
    }
  }, [existingJob, isEdit]);

  const handleAddressSelect = (value: string) => {
    if (value === "custom") {
      setForm((f) => ({ ...f, selectedAddressId: "custom", address: "" }));
      return;
    }
    const addr = clientAddresses?.find((a) => String(a.id) === value);
    if (addr) {
      setForm((f) => ({
        ...f,
        selectedAddressId: value,
        address: buildAddressString(addr),
      }));
    }
  };

  const handleSubmit = async () => {
    if (!form.clientId || !form.title) {
      toast.error("Client and job title are required.");
      return;
    }
    const startMs = fromLocalDateTimeValue(form.scheduledStart);
    const endMs = fromLocalDateTimeValue(form.scheduledEnd);
    if (endMs <= startMs) {
      toast.error("End time must be after start time.");
      return;
    }

    try {
      if (isEdit) {
        await updateJob.mutateAsync({
          id: jobId!,
          clientId: Number(form.clientId),
          title: form.title,
          description: form.description || undefined,
          address: form.address || undefined,
          ownerInstructions: form.ownerInstructions || undefined,
          scheduledStart: startMs,
          scheduledEnd: endMs,
          status: form.status,
          crewMemberIds: form.crewMemberIds,
          syncToGoogleCalendar: form.syncToGoogleCalendar,
          sendReviewSms: form.status === "completed",
        });
        toast.success("Job updated successfully.");
      } else {
        await createJob.mutateAsync({
          clientId: Number(form.clientId),
          title: form.title,
          description: form.description || undefined,
          address: form.address || undefined,
          ownerInstructions: form.ownerInstructions || undefined,
          scheduledStart: startMs,
          scheduledEnd: endMs,
          crewMemberIds: form.crewMemberIds,
          sendBookingSms: form.sendBookingSms,
          syncToGoogleCalendar: form.syncToGoogleCalendar,
        });
        toast.success("Job created successfully.");
      }
      onSuccess();
    } catch (err) {
      toast.error("Failed to save job. Please try again.");
    }
  };

  const isPending = createJob.isPending || updateJob.isPending;
  const hasAddress = form.address.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Job" : "New Job"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client */}
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select
              value={form.clientId}
              onValueChange={(v) => {
                // Reset address when switching clients so the useEffect auto-fills
                setForm((f) => ({ ...f, clientId: v, selectedAddressId: "custom", address: "" }));
              }}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Job Title *</Label>
            <Input
              placeholder="e.g. Electrical panel upgrade"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="bg-input border-border"
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={form.scheduledStart}
                onChange={(e) => setForm((f) => ({ ...f, scheduledStart: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input
                type="datetime-local"
                value={form.scheduledEnd}
                onChange={(e) => setForm((f) => ({ ...f, scheduledEnd: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
          </div>

          {/* Address — saved addresses dropdown + custom */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Job Address
            </Label>

            {/* Address selector when client has saved addresses */}
            {clientAddresses && clientAddresses.length > 0 && (
              <Select value={form.selectedAddressId} onValueChange={handleAddressSelect}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select an address…" />
                </SelectTrigger>
                <SelectContent>
                  {clientAddresses.map((addr) => (
                    <SelectItem key={addr.id} value={String(addr.id)}>
                      <span className="font-medium">{addr.label}</span>
                      {" — "}
                      {addr.addressLine1}
                      {addr.city ? `, ${addr.city}` : ""}
                      {addr.isPrimary && (
                        <span className="ml-1.5 text-xs text-primary">(Primary)</span>
                      )}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Enter custom address
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Address text input — always shown, auto-filled from selection */}
            <div className="flex gap-2">
              <Input
                placeholder="123 Main St, City, State"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value, selectedAddressId: "custom" }))}
                className="bg-input border-border flex-1"
              />
              {hasAddress && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-border"
                  title="Get directions"
                  onClick={() => openDirections(form.address)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
            {hasAddress && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Click the arrow icon to open directions in Google Maps
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of the job…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="bg-input border-border resize-none"
              rows={2}
            />
          </div>

          {/* Owner instructions */}
          <div className="space-y-1.5">
            <Label>Instructions for Crew</Label>
            <Textarea
              placeholder="Notes and instructions for the crew before they arrive…"
              value={form.ownerInstructions}
              onChange={(e) => setForm((f) => ({ ...f, ownerInstructions: e.target.value }))}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as typeof form.status }))}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Crew assignment */}
          {crewList && crewList.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign Crew</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-input border border-border rounded-lg">
                {crewList.map((member) => {
                  const isSelected = form.crewMemberIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          crewMemberIds: isSelected
                            ? f.crewMemberIds.filter((id) => id !== member.id)
                            : [...f.crewMemberIds, member.id],
                        }))
                      }
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            {!isEdit && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Send booking SMS</p>
                  <p className="text-xs text-muted-foreground">Text client a confirmation via OpenPhone</p>
                </div>
                <Switch
                  checked={form.sendBookingSms}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, sendBookingSms: v }))}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sync to Google Calendar</p>
                <p className="text-xs text-muted-foreground">Add event to your calendar</p>
              </div>
              <Switch
                checked={form.syncToGoogleCalendar}
                onCheckedChange={(v) => setForm((f) => ({ ...f, syncToGoogleCalendar: v }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
