"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send, ArrowLeft } from "lucide-react";
import { cn, initials, relativeTime } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface DmMessage {
  id: string;
  senderId: string;
  text: string;
  isRead: boolean;
  createdAt: Date | string;
}

interface OtherUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

interface DmModalProps {
  targetUserId: string | null;
  targetUserName: string;
  currentUserId: string;
  open: boolean;
  onClose: () => void;
}

export function DmModal({ targetUserId, targetUserName, currentUserId, open, onClose }: DmModalProps) {
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchMessages = useCallback(async () => {
    if (!targetUserId) return;
    try {
      const res = await fetch(`/api/messages/${targetUserId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages: DmMessage[]; otherUser: OtherUser };
      setMessages(data.messages);
      if (data.otherUser) setOtherUser(data.otherUser);
    } catch { /* silent */ }
  }, [targetUserId]);

  useEffect(() => {
    if (!open || !targetUserId) {
      setMessages([]);
      setOtherUser(null);
      clearInterval(pollRef.current);
      return;
    }
    setLoading(true);
    fetchMessages().finally(() => setLoading(false));
    pollRef.current = setInterval(() => void fetchMessages(), 8000);
    return () => clearInterval(pollRef.current);
  }, [open, targetUserId, fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || sending || !targetUserId) return;
    const draft = text.trim();
    setText("");
    setSending(true);

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId, senderId: currentUserId, text: draft, isRead: false, createdAt: new Date(),
    }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(`/api/messages/${targetUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      if (!res.ok) throw new Error("send failed");
      const data = (await res.json()) as { message: DmMessage };
      setMessages((prev) => prev.map((m) => m.id === tempId ? data.message : m));
    } catch {
      toast("Failed to send", "error");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(draft);
    } finally {
      setSending(false);
    }
  };

  const displayName = otherUser?.name ?? targetUserName;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[88] flex flex-col bg-cream-paper sm:items-center sm:justify-center sm:bg-[rgba(26,23,20,0.55)] sm:backdrop-blur-sm sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex h-full flex-col bg-cream-paper sm:h-auto sm:max-h-[600px] sm:w-full sm:max-w-sm sm:rounded-3xl sm:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-cream-dark px-4 py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-2xl text-ink-muted hover:bg-cream hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4 sm:hidden" />
                <X className="hidden h-4 w-4 sm:block" />
              </button>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold text-xs font-bold text-ink">
                {otherUser?.image
                  ? <img src={otherUser.image} alt={displayName} className="h-full w-full object-cover" />
                  : initials(displayName)
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
                <p className="text-xs text-ink-muted">Direct message</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {loading && (
                <div className="py-12 text-center text-sm text-ink-muted">Loading…</div>
              )}
              {!loading && messages.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-3xl">💬</p>
                  <p className="mt-2 text-sm text-ink-muted">Start a conversation with {displayName}</p>
                </div>
              )}
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMe = msg.senderId === currentUserId;
                  return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                        isMe
                          ? "rounded-tr-sm bg-ink text-cream-paper"
                          : "rounded-tl-sm border border-cream-dark bg-white/80 text-ink"
                      )}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <p className={cn("mt-0.5 text-[10px]", isMe ? "text-white/40" : "text-ink-muted")}>
                          {relativeTime(new Date(msg.createdAt))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-cream-dark px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={`Message ${displayName}…`}
                  className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-cream-dark bg-white/80 px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted"
                  maxLength={1000}
                  rows={1}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!text.trim() || sending}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-ink text-cream-paper transition hover:opacity-80 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
