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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  Phone,
  Plus,
  UserPlus,
  Wrench,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useEffect, useState } from "react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { toast } from "sonner";

interface JobFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date;
  jobId?: number;
}

const JOB_TYPES = [
  { value: "service_call", label: "Service Call", icon: Wrench, color: "text-blue-400" },
  { value: "project_job", label: "Project Job", icon: Briefcase, color: "text-violet-400" },
  { value: "sales_call", label: "Sales Call", icon: Phone, color: "text-emerald-400" },
] as const;

type JobType = (typeof JOB_TYPES)[number]["value"];

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

export default function JobFormModal({
  open,
  onClose,
  onSuccess,
  initialDate,
  jobId,
}: JobFormModalProps) {
  const isEdit = !!jobId;
  const utils = trpc.useUtils();

  const { data: clients } = trpc.clients.list.useQuery();
  const { data: crewList } = trpc.crew.list.useQuery({ activeOnly: true });
  const { data: existingJob } = trpc.jobs.getById.useQuery(
    { id: jobId! },
    { enabled: isEdit && open }
  );
  // Projects for project_job type
  const { data: allProjects } = trpc.projects.list.useQuery();
  const activeProjects = allProjects?.filter((p) => p.status === "active" || p.status === "on_hold") ?? [];
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const createJob = trpc.jobs.create.useMutation();
  const updateJob = trpc.jobs.update.useMutation();
  const createClient = trpc.clients.create.useMutation();

  const defaultStart = initialDate ?? new Date();
  defaultStart.setMinutes(0, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 2 * 3600_000);

  const [form, setForm] = useState({
    clientId: "",
    jobType: "service_call" as JobType,
    title: "",
    description: "",
    address: "",
    selectedAddressId: "custom" as string,
    ownerInstructions: "",
    scheduledStart: toLocalDateTimeValue(defaultStart.getTime()),
    scheduledEnd: toLocalDateTimeValue(defaultEnd.getTime()),
    status: "scheduled" as "scheduled" | "in_progress" | "completed" | "cancelled",
    crewMemberIds: [] as number[],
    sendBookingSms: true,
    syncToGoogleCalendar: true,
  });

  // Fetch credentials for selected project
  const { data: projectCredentials } = trpc.projectCredentials.list.useQuery(
    { projectId: Number(selectedProjectId) },
    { enabled: !!selectedProjectId && form.jobType === "project_job" }
  );

  // When a project is selected, auto-fill client
  const handleProjectSelect = (projectIdStr: string) => {
    setSelectedProjectId(projectIdStr);
    const project = activeProjects.find((p) => String(p.id) === projectIdStr);
    if (project) {
      const selectedClient = clients?.find((c) => c.id === project.clientId);
      const clientAddr = selectedClient
        ? [selectedClient.addressLine1, selectedClient.addressLine2, selectedClient.city, selectedClient.state, selectedClient.zip]
            .filter(Boolean).join(", ")
        : "";
      setForm((f) => ({
        ...f,
        clientId: String(project.clientId),
        title: f.title || project.title,
        address: clientAddr || f.address,
        selectedAddressId: "custom",
      }));
    }
  };

  // Client autocomplete state
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  // Inline new-client form state
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [creatingClient, setCreatingClient] = useState(false);

  const { data: clientAddresses } = trpc.clientAddresses.getByClient.useQuery(
    { clientId: Number(form.clientId) },
    { enabled: !!form.clientId && form.clientId !== "" }
  );

  // Auto-fill primary address when client is selected
  useEffect(() => {
    if (!form.clientId || !clientAddresses || clientAddresses.length === 0) return;
    if (form.address !== "") return;
    const primary = clientAddresses.find((a) => a.isPrimary) ?? clientAddresses[0];
    if (primary) {
      const addrStr = buildAddressString(primary);
      setForm((f) => ({ ...f, selectedAddressId: String(primary.id), address: addrStr }));
    }
  }, [clientAddresses, form.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate form in edit mode
  useEffect(() => {
    if (existingJob && isEdit) {
      setForm({
        clientId: String(existingJob.clientId),
        jobType: (existingJob.jobType as JobType) ?? "service_call",
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
  }, [existingJob, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleCreateNewClient = async () => {
    if (!newClient.name.trim()) {
      toast.error("Client name is required.");
      return;
    }
    setCreatingClient(true);
    try {
      await createClient.mutateAsync({
        name: newClient.name.trim(),
        phone: newClient.phone || undefined,
        email: newClient.email || undefined,
        addressLine1: newClient.address || undefined,
      });
      await utils.clients.list.invalidate();
      // Refetch client list and auto-select the new client
      const updatedClients = await utils.clients.list.fetch();
      const created = updatedClients?.find((c) => c.name === newClient.name.trim());
      if (created) {
        setForm((f) => ({
          ...f,
          clientId: String(created.id),
          address: newClient.address || f.address,
        }));
      }
      setNewClient({ name: "", phone: "", email: "", address: "" });
      setShowNewClient(false);
      toast.success(`Client "${newClient.name}" created and selected.`);
    } catch {
      toast.error("Failed to create client.");
    } finally {
      setCreatingClient(false);
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
          jobType: form.jobType,
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
          jobType: form.jobType,
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
    } catch {
      toast.error("Failed to save job. Please try again.");
    }
  };

  const isPending = createJob.isPending || updateJob.isPending;
  const hasAddress = form.address.trim().length > 0;
  const selectedJobType = JOB_TYPES.find((t) => t.value === form.jobType)!;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Job" : "New Job"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Job Type */}
          <div className="space-y-1.5">
            <Label>Job Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {JOB_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = form.jobType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, jobType: type.value }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-muted border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : type.color}`} />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project selector — only shown when job type is project_job */}
          {form.jobType === "project_job" && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-violet-400" />
                Link to Project
              </Label>
              <Select value={selectedProjectId} onValueChange={handleProjectSelect}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select an active project…" />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No active projects found</div>
                  ) : (
                    activeProjects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <span className="font-medium">{p.title}</span>
                        {p.clientName && (
                          <span className="text-muted-foreground ml-1.5 text-xs">— {p.clientName}</span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Project credentials panel */}
              {selectedProjectId && projectCredentials && projectCredentials.length > 0 && (
                <div className="mt-2 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-violet-400 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    Project Credentials
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {projectCredentials.map((cred) => (
                      <div key={cred.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{cred.label}</span>
                        <span className="font-mono text-foreground bg-muted px-2 py-0.5 rounded select-all">
                          {cred.value || <span className="italic text-muted-foreground">not set</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Client */}
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <div className="flex gap-2">
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientSearchOpen}
                    className="flex-1 justify-between bg-input border-border font-normal text-left h-9 px-3"
                  >
                    <span className={form.clientId ? "text-foreground" : "text-muted-foreground"}>
                      {form.clientId
                        ? (clients?.find((c) => String(c.id) === form.clientId)?.name ?? "Select a client…")
                        : "Search clients…"}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type a name to search…"
                      value={clientSearchQuery}
                      onValueChange={setClientSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No clients found.</CommandEmpty>
                      <CommandGroup>
                        {(clients ?? [])
                          .filter((c) =>
                            clientSearchQuery.trim() === "" ||
                            c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
                          )
                          .slice(0, 50)
                          .map((c) => (
                            <CommandItem
                              key={c.id}
                              value={String(c.id)}
                              onSelect={() => {
                                const clientAddr = [
                                  c.addressLine1, c.addressLine2, c.city, c.state, c.zip,
                                ].filter(Boolean).join(", ");
                                setForm((f) => ({
                                  ...f,
                                  clientId: String(c.id),
                                  selectedAddressId: "custom",
                                  address: clientAddr || f.address,
                                }));
                                setShowNewClient(false);
                                setClientSearchQuery("");
                                setClientSearchOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-3.5 w-3.5 shrink-0 ${
                                  form.clientId === String(c.id) ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{c.name}</p>
                                {(c.phone || c.addressLine1) && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {[c.phone, c.addressLine1].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 border-border"
                title="Add new client"
                onClick={() => setShowNewClient((v) => !v)}
              >
                {showNewClient ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Inline new-client form */}
            {showNewClient && (
              <div className="mt-2 p-4 bg-muted/50 border border-border rounded-lg space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Create New Client
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name *</Label>
                    <Input
                      placeholder="Full name"
                      value={newClient.name}
                      onChange={(e) => setNewClient((n) => ({ ...n, name: e.target.value }))}
                      className="bg-input border-border h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input
                      placeholder="(555) 000-0000"
                      value={newClient.phone}
                      onChange={(e) => setNewClient((n) => ({ ...n, phone: e.target.value }))}
                      className="bg-input border-border h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    placeholder="email@example.com"
                    value={newClient.email}
                    onChange={(e) => setNewClient((n) => ({ ...n, email: e.target.value }))}
                    className="bg-input border-border h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address</Label>
                  <AddressAutocomplete
                    placeholder="123 Main St, City, State"
                    value={newClient.address}
                    onChange={(v) => setNewClient((n) => ({ ...n, address: v }))}
                    onPlaceSelect={({ formatted }) => setNewClient((n) => ({ ...n, address: formatted }))}
                    className="bg-input border-border h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateNewClient}
                    disabled={creatingClient || !newClient.name.trim()}
                    className="flex-1"
                  >
                    {creatingClient && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create & Select
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewClient(false)}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Job Title *</Label>
            <Input
              placeholder={
                form.jobType === "service_call"
                  ? "e.g. Electrical panel upgrade"
                  : form.jobType === "project_job"
                  ? "e.g. Kitchen renovation — Phase 2"
                  : "e.g. Initial consultation — Smith property"
              }
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

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Job Address
            </Label>

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

            <div className="flex gap-2">
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => setForm((f) => ({ ...f, address: v, selectedAddressId: "custom" }))}
                onPlaceSelect={({ formatted }) =>
                  setForm((f) => ({ ...f, address: formatted, selectedAddressId: "custom" }))
                }
                placeholder="123 Main St, City, State"
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
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : `Create ${selectedJobType.label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
