import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Briefcase,
  Building2,
  Home,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Search,
  Star,
  StickyNote,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

function addressLabelIcon(label: string) {
  switch (label?.toLowerCase()) {
    case "business": return <Building2 className="h-3.5 w-3.5" />;
    case "home": return <Home className="h-3.5 w-3.5" />;
    default: return <MapPin className="h-3.5 w-3.5" />;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "scheduled": return "bg-blue-500/10 text-blue-600 border-blue-200";
    case "in_progress": return "bg-amber-500/10 text-amber-600 border-amber-200";
    case "completed": return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "cancelled": return "bg-red-500/10 text-red-600 border-red-200";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function CrewClientsPage() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const { data: clients = [], isLoading } = trpc.clients.list.useQuery();
  const { data: allJobs = [] } = trpc.jobs.list.useQuery();

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {clients.length} client{clients.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {search ? "No clients match your search." : "No clients yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {filtered.map((client) => {
        const clientJobs = allJobs.filter((j) => j.clientId === client.id);
        const primaryAddress = [
          client.addressLine1,
          client.city,
          client.state,
          client.zip,
        ]
          .filter(Boolean)
          .join(", ");

        return (
          <Card key={client.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold">{client.name}</CardTitle>
                  <div className="flex flex-col gap-1 mt-1.5">
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {client.phone}
                      </a>
                    )}
                    {client.email && (
                      <a
                        href={`mailto:${client.email}`}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors truncate"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </a>
                    )}
                    {primaryAddress && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{primaryAddress}</span>
                      </div>
                    )}
                  </div>
                </div>
                {primaryAddress && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(primaryAddress)}`,
                        "_blank"
                      )
                    }
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Directions
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Accordion type="multiple" className="w-full">
                {/* Addresses */}
                <ClientAddressesSection clientId={client.id} />

                {/* Jobs */}
                <AccordionItem value="jobs" className="border-t border-border/50">
                  <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      Jobs ({clientJobs.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {clientJobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No jobs for this client.</p>
                    ) : (
                      <div className="space-y-2 pb-2">
                        {clientJobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
                            onClick={() => setLocation(`/jobs/${job.id}`)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{job.title}</p>
                              {job.scheduledStart && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(job.scheduledStart), "MMM d, yyyy · h:mm a")}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs shrink-0 ${statusColor(job.status ?? "scheduled")}`}
                            >
                              {(job.status ?? "scheduled").replace("_", " ")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Notes */}
                {client.notes && (
                  <AccordionItem value="notes" className="border-t border-border/50">
                    <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                      <span className="flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-muted-foreground" />
                        Client Notes
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground pb-2 whitespace-pre-wrap">{client.notes}</p>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Sub-component: loads addresses for a client
function ClientAddressesSection({ clientId }: { clientId: number }) {
  const { data: addresses = [] } = trpc.clientAddresses.getByClient.useQuery({ clientId });

  if (addresses.length === 0) return null;

  return (
    <AccordionItem value="addresses" className="border-none">
      <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Addresses ({addresses.length})
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2 pb-2">
          {addresses.map((addr) => {
            const fullAddress = [addr.addressLine1, addr.city, addr.state, addr.zip]
              .filter(Boolean)
              .join(", ");
            return (
              <div
                key={addr.id}
                className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {addressLabelIcon(addr.label ?? "")}
                    <span className="text-xs font-semibold capitalize text-muted-foreground">
                      {addr.label ?? "Address"}
                    </span>
                    {addr.isPrimary && (
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    )}
                  </div>
                  <p className="text-sm">{fullAddress}</p>

                </div>
                {fullAddress && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 px-2 gap-1 text-xs"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`,
                        "_blank"
                      )
                    }
                  >
                    <Navigation className="h-3 w-3" />
                    Go
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
