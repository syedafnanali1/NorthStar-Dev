"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock } from "lucide-react";
import { cn, initials, relativeTime } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface PendingUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

interface PendingRequest {
  connectionId: string;
  direction: "incoming" | "outgoing";
  createdAt: Date | string;
  user: PendingUser;
}

interface PendingRequestsPanelProps {
  requests: PendingRequest[];
  onAccepted: (userName: string) => void;
}

export function PendingRequestsPanel({ requests, onAccepted }: PendingRequestsPanelProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const incoming = requests.filter((r) => r.direction === "incoming" && !dismissed.has(r.connectionId));
  const outgoing = requests.filter((r) => r.direction === "outgoing" && !dismissed.has(r.connectionId));

  if (incoming.length === 0 && outgoing.length === 0) return null;

  const respond = async (connectionId: string, action: "accept" | "decline", userName: string) => {
    if (processing.has(connectionId)) return;
    setProcessing((s) => new Set(s).add(connectionId));
    try {
      const res = await fetch(`/api/friends/requests/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      setDismissed((s) => new Set(s).add(connectionId));
      if (action === "accept") {
        toast(`Connected with ${userName} ✓`);
        onAccepted(userName);
        router.refresh();
      } else {
        toast("Request declined");
      }
    } catch {
      toast("Failed to respond", "error");
    } finally {
      setProcessing((s) => { const n = new Set(s); n.delete(connectionId); return n; });
    }
  };

  return (
    <div className="space-y-2">
      {incoming.length > 0 && (
        <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/80">
            {incoming.length} Circle Request{incoming.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-3">
            {incoming.map((req) => {
              const name = req.user.name ?? `@${req.user.username}`;
              const busy = processing.has(req.connectionId);
              return (
                <div key={req.connectionId} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold text-xs font-bold text-ink">
                    {req.user.image
                      ? <img src={req.user.image} alt={name} className="h-full w-full object-cover" />
                      : initials(req.user.name)
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{name}</p>
                    <p className="text-xs text-ink-muted">{relativeTime(new Date(req.createdAt))}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void respond(req.connectionId, "decline", name)}
                      disabled={busy}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl border border-cream-dark bg-white/70 text-ink-muted transition hover:text-rose active:scale-90 disabled:opacity-40"
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void respond(req.connectionId, "accept", name)}
                      disabled={busy}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-cream-paper transition hover:opacity-80 active:scale-90 disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="rounded-2xl border border-cream-dark bg-white/60 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Sent Requests
          </p>
          <div className="flex flex-wrap gap-2">
            {outgoing.map((req) => {
              const name = req.user.name ?? `@${req.user.username}`;
              return (
                <div
                  key={req.connectionId}
                  className="flex items-center gap-2 rounded-xl border border-cream-dark bg-cream px-3 py-1.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gold text-[9px] font-bold text-ink">
                    {req.user.image
                      ? <img src={req.user.image} alt={name} className="h-full w-full object-cover" />
                      : initials(req.user.name)
                    }
                  </div>
                  <span className="text-xs font-medium text-ink">{name}</span>
                  <Clock className="h-3 w-3 text-ink-muted" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
