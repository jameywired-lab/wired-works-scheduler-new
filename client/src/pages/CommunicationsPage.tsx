import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageSquare, Voicemail, PhoneMissed, Clock, User, ChevronDown, ChevronRight, Play } from "lucide-react";

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function fullDateTime(date: Date | string) {
  return new Date(date).toLocaleString();
}

// ─── SMS Threads Tab ──────────────────────────────────────────────────────────

function SmsThreadsTab() {
  const { data: threads, isLoading } = trpc.communications.listThreads.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: messages } = trpc.communications.listMessages.useQuery(
    expanded ? { phone: expanded, limit: 100 } : undefined,
    { enabled: !!expanded }
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!threads?.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="font-medium">No SMS messages yet</p>
        <p className="text-sm mt-1">Inbound texts from OpenPhone will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map(thread => (
        <div key={thread.phone} className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
            onClick={() => setExpanded(expanded === thread.phone ? null : thread.phone)}
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {thread.contactName ?? formatPhone(thread.phone)}
                </span>
                {thread.contactName && (
                  <span className="text-xs text-muted-foreground">{formatPhone(thread.phone)}</span>
                )}
                <Badge variant="secondary" className="ml-auto text-xs">{thread.count}</Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{thread.lastMessage}</p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">{timeAgo(thread.lastAt)}</span>
              {expanded === thread.phone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </button>

          {expanded === thread.phone && (
            <div className="border-t bg-muted/20 p-4 space-y-3 max-h-80 overflow-y-auto">
              {messages?.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.direction === "outbound"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-background border rounded-bl-sm"
                    }`}
                  >
                    <p>{msg.body}</p>
                    <p className={`text-xs mt-1 ${msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {fullDateTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Calls Tab ────────────────────────────────────────────────────────────────

function CallsTab({ filter }: { filter: "all" | "missed" | "voicemail" }) {
  const { data: calls, isLoading } = trpc.communications.listCalls.useQuery(
    { status: filter, limit: 100 },
    { refetchInterval: 30_000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!calls?.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        {filter === "missed" ? (
          <PhoneMissed className="mx-auto mb-3 h-10 w-10 opacity-40" />
        ) : filter === "voicemail" ? (
          <Voicemail className="mx-auto mb-3 h-10 w-10 opacity-40" />
        ) : (
          <Phone className="mx-auto mb-3 h-10 w-10 opacity-40" />
        )}
        <p className="font-medium">
          {filter === "missed" ? "No missed calls" : filter === "voicemail" ? "No voicemails" : "No calls yet"}
        </p>
        <p className="text-sm mt-1">Calls from OpenPhone will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map(call => (
        <Card key={call.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                call.status === "missed" ? "bg-red-100 text-red-600" :
                call.status === "voicemail" ? "bg-purple-100 text-purple-600" :
                "bg-green-100 text-green-600"
              }`}>
                {call.status === "missed" ? <PhoneMissed className="h-4 w-4" /> :
                 call.status === "voicemail" ? <Voicemail className="h-4 w-4" /> :
                 <Phone className="h-4 w-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">
                    {call.contactName ?? formatPhone(call.fromNumber)}
                  </span>
                  {call.contactName && (
                    <span className="text-xs text-muted-foreground">{formatPhone(call.fromNumber)}</span>
                  )}
                  <Badge
                    variant={call.status === "missed" ? "destructive" : call.status === "voicemail" ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {call.status === "missed" ? "Missed" :
                     call.status === "voicemail" ? "Voicemail" :
                     call.status === "completed" ? "Answered" : call.status}
                  </Badge>
                  {call.duration && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(call.duration)}
                    </span>
                  )}
                </div>

                {call.transcription && (
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    "{call.transcription}"
                  </p>
                )}

                {call.recordingUrl && (
                  <div className="mt-2">
                    <audio controls className="h-8 w-full max-w-xs" src={call.recordingUrl}>
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{timeAgo(call.createdAt)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(call.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommunicationsPage() {
  const { data: missedCalls } = trpc.communications.listCalls.useQuery({ status: "missed", limit: 100 });
  const { data: voicemails } = trpc.communications.listCalls.useQuery({ status: "voicemail", limit: 100 });

  const missedCount = missedCalls?.length ?? 0;
  const voicemailCount = voicemails?.length ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Communications</h1>
        <p className="text-muted-foreground mt-1">
          Your OpenPhone inbox — texts, calls, and voicemails in one place.
        </p>
      </div>

      <Tabs defaultValue="sms">
        <TabsList className="mb-4">
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Text Messages
          </TabsTrigger>
          <TabsTrigger value="missed" className="flex items-center gap-2">
            <PhoneMissed className="h-4 w-4" />
            Missed Calls
            {missedCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0 h-4">
                {missedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="voicemail" className="flex items-center gap-2">
            <Voicemail className="h-4 w-4" />
            Voicemails
            {voicemailCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-4">
                {voicemailCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all-calls" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            All Calls
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sms">
          <SmsThreadsTab />
        </TabsContent>

        <TabsContent value="missed">
          <CallsTab filter="missed" />
        </TabsContent>

        <TabsContent value="voicemail">
          <CallsTab filter="voicemail" />
        </TabsContent>

        <TabsContent value="all-calls">
          <CallsTab filter="all" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
