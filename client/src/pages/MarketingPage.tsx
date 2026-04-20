import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  Send,
  Users,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

export default function MarketingPage() {
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading: campaignsLoading } = trpc.marketing.listCampaigns.useQuery();
  const { data: tags } = trpc.tags.list.useQuery();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string>("all");
  const [expandedCampaign, setExpandedCampaign] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Audience preview
  const tagIdForQuery = selectedTagId === "all" ? null : parseInt(selectedTagId);
  const { data: audience } = trpc.marketing.previewAudience.useQuery(
    { tagId: tagIdForQuery },
    { enabled: previewOpen || true }
  );
  const withEmail = (audience ?? []).filter((c) => c.email && c.email.trim() !== "");

  const sendCampaign = trpc.marketing.sendCampaign.useMutation({
    onSuccess: (data) => {
      utils.marketing.listCampaigns.invalidate();
      toast.success(
        data.pendingEmail
          ? `Campaign saved — ${data.recipientCount} recipients queued. Connect an email provider to send.`
          : `Campaign sent to ${data.recipientCount} recipients!`
      );
      setSubject("");
      setBody("");
      setSelectedTagId("all");
    },
    onError: () => toast.error("Failed to save campaign"),
  });

  const selectedTag = tags?.find((t) => t.id === tagIdForQuery);

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message body are required");
      return;
    }
    sendCampaign.mutate({
      subject: subject.trim(),
      body: body.trim(),
      tagId: tagIdForQuery,
      tagName: selectedTag?.name ?? null,
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Send newsletters, updates, and product news to your clients
          </p>
        </div>
      </div>

      {/* Email Provider Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Email provider not yet connected
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Campaigns are saved and recipients are recorded, but emails will not be sent until you
            connect an email provider (Resend, SendGrid, or Gmail SMTP). Ask your developer to add
            the API key when ready.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Compose Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audience selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Send To</label>
                <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {tags?.map((tag) => (
                      <SelectItem key={tag.id} value={String(tag.id)}>
                        <span className="flex items-center gap-2">
                          {tag.name}
                          {'clientCount' in tag && (
                            <span className="ml-1 text-muted-foreground text-xs">({(tag as any).clientCount})</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>
                    {withEmail.length} recipient{withEmail.length !== 1 ? "s" : ""} with email
                    address
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="ml-1 text-primary hover:underline flex items-center gap-0.5"
                  >
                    <Eye className="h-3 w-3" /> Preview
                  </button>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Subject Line</label>
                <Input
                  placeholder="e.g. New Product Announcement — Smart Lighting"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-input border-border"
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Message</label>
                <Textarea
                  placeholder="Write your message here. You can use plain text or basic HTML for formatting."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="bg-input border-border min-h-[200px] resize-y font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Use &lt;b&gt;bold&lt;/b&gt;, &lt;br&gt; for line breaks, or plain text.
                </p>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleSend}
                disabled={sendCampaign.isPending || !subject.trim() || !body.trim()}
              >
                <Send className="h-4 w-4" />
                {sendCampaign.isPending ? "Saving..." : `Save Campaign (${withEmail.length} recipients)`}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Audience Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total clients</span>
                <span className="font-semibold">{audience?.length ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">With email</span>
                <span className="font-semibold text-green-500">{withEmail.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">No email</span>
                <span className="font-semibold text-muted-foreground">
                  {(audience?.length ?? 0) - withEmail.length}
                </span>
              </div>
              {selectedTag && (
                <div className="pt-2 border-t border-border">
                  <Badge
                    style={{ backgroundColor: selectedTag.color + "33", color: selectedTag.color }}
                    className="text-xs"
                  >
                    {selectedTag.name}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Campaigns Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{campaigns?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Total campaigns</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Campaign History */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Campaign History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No campaigns yet. Send your first one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  isExpanded={expandedCampaign === c.id}
                  onToggle={() =>
                    setExpandedCampaign(expandedCampaign === c.id ? null : c.id)
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audience Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Audience Preview — {withEmail.length} recipient{withEmail.length !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {withEmail.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No clients with email addresses in this segment.
              </p>
            ) : (
              withEmail.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Campaign Row ─────────────────────────────────────────────────────────────
function CampaignRow({
  campaign,
  isExpanded,
  onToggle,
}: {
  campaign: { id: number; subject: string; body: string; tagFilter: string | null; recipientCount: number; sentAt: Date | null; createdAt: Date };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { data: recipients } = trpc.marketing.getCampaignRecipients.useQuery(
    { campaignId: campaign.id },
    { enabled: isExpanded }
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{campaign.subject}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(campaign.createdAt).toLocaleDateString()}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {campaign.recipientCount} recipients
            </span>
            {campaign.tagFilter && (
              <Badge variant="outline" className="text-xs h-4 px-1.5">
                {campaign.tagFilter}
              </Badge>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs shrink-0 border-amber-500/50 text-amber-600 dark:text-amber-400"
        >
          Pending Send
        </Badge>
      </button>

      {isExpanded && (
        <div className="border-t border-border p-3 bg-muted/10 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Message Preview</p>
            <div
              className="text-sm bg-background rounded p-3 border border-border max-h-40 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: campaign.body.replace(/\n/g, "<br>") }}
            />
          </div>
          {recipients && recipients.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Recipients ({recipients.length})
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {recipients.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    {r.status === "sent" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    ) : r.status === "failed" ? (
                      <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                    ) : (
                      <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                    <span className="font-medium">{r.clientName ?? r.email}</span>
                    <span className="text-muted-foreground">{r.email}</span>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-xs h-4 px-1 ${
                        r.status === "sent"
                          ? "border-green-500/50 text-green-600"
                          : r.status === "failed"
                          ? "border-red-500/50 text-red-600"
                          : "border-amber-500/50 text-amber-600"
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
