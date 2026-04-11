"use client";

// src/components/group-goals/group-chat.tsx
// Real-time-style group chat with optimistic message sending.

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { cn, initials } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";

interface ChatMessage {
  id: string;
  text: string;
  createdAt: string | Date;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface GroupChatProps {
  groupGoalId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
}

function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function GroupChat({
  groupGoalId,
  currentUserId,
  initialMessages,
}: GroupChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    // Optimistic message
    const optimisticId = `opt_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      text,
      createdAt: new Date().toISOString(),
      user: { id: currentUserId, name: "You", image: null },
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    setSending(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to send");
      }

      const data = (await res.json()) as { message: ChatMessage };
      // Replace optimistic with real
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? data.message : m))
      );
    } catch (err) {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft(text);
      toast(err instanceof Error ? err.message : "Failed to send message", "error");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-cream-dark bg-white overflow-hidden">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px] min-h-[200px]">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-muted py-8">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((m) => {
            const isMe = m.user.id === currentUserId;
            return (
              <div
                key={m.id}
                className={cn("flex items-end gap-2", isMe && "flex-row-reverse")}
              >
                {/* Avatar */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[9px] font-bold text-ink">
                  {m.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.user.image}
                      alt={m.user.name ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(m.user.name)
                  )}
                </div>

                {/* Bubble */}
                <div className={cn("max-w-[72%] space-y-0.5", isMe && "items-end flex flex-col")}>
                  {!isMe && (
                    <p className="text-[10px] font-semibold text-ink-muted px-1">
                      {m.user.name ?? "Member"}
                    </p>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-sm leading-snug",
                      isMe
                        ? "bg-ink text-cream-paper rounded-br-sm"
                        : "bg-cream text-ink rounded-bl-sm"
                    )}
                  >
                    {m.text}
                  </div>
                  <p className="text-[10px] text-ink-muted px-1">
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-cream-dark flex items-center gap-2 px-3 py-3">
        <input
          ref={inputRef}
          className="flex-1 rounded-xl border border-cream-dark bg-cream px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:border-ink/30 transition"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          maxLength={1000}
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
            draft.trim()
              ? "bg-ink text-cream-paper hover:bg-ink/80"
              : "bg-cream text-ink-muted"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
