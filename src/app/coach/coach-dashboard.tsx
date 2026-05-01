"use client";

// src/app/coach/coach-dashboard.tsx
// Coach Dashboard for North Star Coaches plan ($49/mo).
// Shows team member overview, goal retention metrics, and an AI coaching chat.
// When ENFORCE_PAYMENTS is false, all users can access this screen.

import { useState } from "react";
import Link from "next/link";
import {
  BarChart2,
  Brain,
  Download,
  Lock,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import { isCoachPlan, type SubscriptionUser } from "@/utils/subscriptionUtils";
import { ENFORCE_PAYMENTS } from "@/config/subscriptionConfig";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  activeGoals: number;
  completedGoals: number;
  completionRate: number;
}

interface CoachDashboardProps {
  user: SubscriptionUser;
  teamMembers: TeamMember[];
  teamStats: {
    totalGoals: number;
    completedGoals: number;
    retentionRate: number;
    avgGoalsPerUser: number;
  };
}

function statusColor(rate: number): string {
  if (rate >= 70) return "text-emerald-500";
  if (rate >= 40) return "text-amber-400";
  return "text-rose-400";
}

function statusLabel(rate: number): string {
  if (rate >= 70) return "On track";
  if (rate >= 40) return "At risk";
  return "Behind";
}

const PROMPT_STARTERS = [
  "Which team members need the most support right now?",
  "What's causing our low goal retention this month?",
  "Give me a 30-day plan to improve team performance.",
  "Who are our top performers and what are they doing differently?",
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function CoachDashboard({ user, teamMembers, teamStats }: CoachDashboardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const hasAccess = !ENFORCE_PAYMENTS || isCoachPlan(user);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
          <Lock className="h-7 w-7 text-gold" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-ink">Coach Dashboard</h2>
          <p className="mt-1 text-ink-muted">Unlock the Coach Dashboard — $49/mo</p>
        </div>
        <Link
          href="/premium"
          className="mt-2 rounded-xl bg-gold px-6 py-2.5 text-sm font-semibold text-ink hover:opacity-90 transition-opacity"
        >
          Get Coach Access
        </Link>
      </div>
    );
  }

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setAiError(null);
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAiLoading(true);

    try {
      const res = await fetch("/api/coach/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          teamStats,
          memberCount: teamMembers.length,
          history: messages.slice(-6),
        }),
      });

      if (!res.ok) throw new Error("AI request failed");

      const json = (await res.json()) as { reply?: string; error?: string };
      if (!json.reply) throw new Error(json.error ?? "No response from AI");

      setMessages((prev) => [...prev, { role: "assistant", content: json.reply! }]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI coaching unavailable");
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = () => {
    const lines = [
      "NorthStar Coach Report",
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      "TEAM OVERVIEW",
      `Total Goals: ${teamStats.totalGoals}`,
      `Completed Goals: ${teamStats.completedGoals}`,
      `Retention Rate: ${teamStats.retentionRate}%`,
      `Avg Goals per User: ${teamStats.avgGoalsPerUser}`,
      "",
      "MEMBERS",
      ...teamMembers.map(
        (m) =>
          `${m.name ?? "Unknown"} — Active: ${m.activeGoals}, Completed: ${m.completedGoals}, Rate: ${m.completionRate}%`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "northstar-coach-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-page-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Coach Dashboard</p>
          <h1 className="mt-1.5 font-serif text-2xl text-ink sm:text-3xl">
            Team Performance
          </h1>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl border border-cream-dark px-3 py-2 text-sm font-medium text-ink-muted transition-all hover:bg-cream hover:text-ink"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Goals", value: teamStats.totalGoals, icon: BarChart2 },
          { label: "Completed", value: teamStats.completedGoals, icon: TrendingUp },
          { label: "Retention Rate", value: `${teamStats.retentionRate}%`, icon: Users },
          { label: "Avg per User", value: teamStats.avgGoalsPerUser, icon: Brain },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-cream-dark bg-cream-paper p-4">
            <Icon className="h-4 w-4 text-gold mb-2" />
            <p className="text-2xl font-bold text-ink">{value}</p>
            <p className="text-xs text-ink-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Team Members */}
      <section>
        <h2 className="font-semibold text-ink mb-3">Team Overview</h2>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-ink-muted">No team members yet. Invite people to get started.</p>
        ) : (
          <div className="space-y-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-cream-dark bg-cream-paper px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-ink">
                    {member.name?.slice(0, 2).toUpperCase() ?? "??"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{member.name ?? "Unknown"}</p>
                    <p className="text-xs text-ink-muted">
                      {member.activeGoals} active · {member.completedGoals} completed
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${statusColor(member.completionRate)}`}>
                  {statusLabel(member.completionRate)} ({member.completionRate}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Team Performance Coach */}
      <section className="rounded-2xl border border-cream-dark bg-cream-paper overflow-hidden">
        <div className="flex items-center gap-2 border-b border-cream-dark px-5 py-4">
          <Brain className="h-4 w-4 text-gold" />
          <h2 className="font-semibold text-ink">AI Performance Coach</h2>
        </div>

        {/* Chat history */}
        <div className="h-64 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-ink-muted">
              Ask me anything about your team&apos;s performance.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-ink text-cream-paper"
                    : "bg-cream text-ink"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-cream px-4 py-2.5 text-sm text-ink-muted">
                Thinking…
              </div>
            </div>
          )}
          {aiError && (
            <p className="text-xs text-rose-400">{aiError}</p>
          )}
        </div>

        {/* Prompt starters */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {PROMPT_STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => sendMessage(starter)}
                className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold hover:bg-gold/20 transition-colors"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-cream-dark px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask about your team…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || aiLoading}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold text-ink transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}
