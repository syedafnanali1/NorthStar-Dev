"use client";

// src/components/group-goals/group-icon-picker.tsx
// Icon picker for group owners to change the group icon.
// Supports emoji options and SVG (Lucide-based) icon options.

import { useState } from "react";
import { X, Check } from "lucide-react";
import {
  Dumbbell, Bike, Flame, Heart, Activity, Apple,
  TrendingUp, DollarSign, PiggyBank, BarChart2, Landmark,
  BookOpen, GraduationCap, PenLine, Lightbulb, ScrollText,
  Briefcase, Rocket, Trophy, Target, Zap,
  Palette, Music, Camera, Pencil, Sparkles,
  Users, Globe, Home, MessageCircle, Handshake,
  Leaf, Coffee, Utensils, Plane, Mountain,
  Brain, Star, Sun, Compass, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import type { LucideIcon } from "lucide-react";

// ─── Icon definitions ──────────────────────────────────────────────────────────

const EMOJI_OPTIONS = [
  // Fitness & Health
  "💪", "🏃", "🧘", "🥗", "🏋️", "⚽", "🎾", "🏊", "🚴", "🥊",
  // Finance
  "💰", "📈", "💳", "🏦", "💵", "🪙", "📊", "💹", "🏠", "🎯",
  // Learning & Writing
  "📚", "✍️", "🎓", "📝", "🔬", "🧪", "📖", "🗂️", "✏️", "🖊️",
  // Mindset & Wellness
  "🧠", "⭐", "🌟", "🌈", "🔥", "💎", "🌸", "🦋", "🕊️", "☀️",
  // Creativity
  "🎨", "🎵", "📷", "🎭", "🎬", "🎸", "🎤", "🖌️", "🎹", "🎻",
  // Career & Productivity
  "🚀", "🏆", "💼", "⚡", "🎖️", "🔑", "🛠️", "💡", "📌", "🗓️",
  // Community & Lifestyle
  "🤝", "🌍", "🏡", "☕", "🍃", "✈️", "🏔️", "🌊", "🌺", "🦁",
];

interface SvgOption {
  id: string;
  label: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
}

const SVG_OPTIONS: SvgOption[] = [
  // Fitness
  { id: "svg:Dumbbell",       label: "Dumbbell",    Icon: Dumbbell,      color: "#e07d3a", bg: "#e07d3a22" },
  { id: "svg:Bike",           label: "Cycling",     Icon: Bike,          color: "#e07d3a", bg: "#e07d3a22" },
  { id: "svg:Flame",          label: "Burn",        Icon: Flame,         color: "#ef4444", bg: "#ef444422" },
  { id: "svg:Heart",          label: "Health",      Icon: Heart,         color: "#ec4899", bg: "#ec489922" },
  { id: "svg:Activity",       label: "Activity",    Icon: Activity,      color: "#4caf82", bg: "#4caf8222" },
  { id: "svg:Apple",          label: "Nutrition",   Icon: Apple,         color: "#4caf82", bg: "#4caf8222" },
  // Finance
  { id: "svg:TrendingUp",     label: "Growth",      Icon: TrendingUp,    color: "#3a7fe0", bg: "#3a7fe022" },
  { id: "svg:DollarSign",     label: "Money",       Icon: DollarSign,    color: "#3a7fe0", bg: "#3a7fe022" },
  { id: "svg:PiggyBank",      label: "Savings",     Icon: PiggyBank,     color: "#8b5cf6", bg: "#8b5cf622" },
  { id: "svg:BarChart2",      label: "Analytics",   Icon: BarChart2,     color: "#3a7fe0", bg: "#3a7fe022" },
  { id: "svg:Landmark",       label: "Finance",     Icon: Landmark,      color: "#0891b2", bg: "#0891b222" },
  // Learning
  { id: "svg:BookOpen",       label: "Reading",     Icon: BookOpen,      color: "#92644a", bg: "#92644a22" },
  { id: "svg:GraduationCap",  label: "Education",   Icon: GraduationCap, color: "#8b5cf6", bg: "#8b5cf622" },
  { id: "svg:PenLine",        label: "Writing",     Icon: PenLine,       color: "#d97706", bg: "#d9770622" },
  { id: "svg:Lightbulb",      label: "Ideas",       Icon: Lightbulb,     color: "#d97706", bg: "#d9770622" },
  { id: "svg:ScrollText",     label: "Notes",       Icon: ScrollText,    color: "#92644a", bg: "#92644a22" },
  // Career
  { id: "svg:Briefcase",      label: "Career",      Icon: Briefcase,     color: "#0891b2", bg: "#0891b222" },
  { id: "svg:Rocket",         label: "Startup",     Icon: Rocket,        color: "#8b5cf6", bg: "#8b5cf622" },
  { id: "svg:Trophy",         label: "Achievement", Icon: Trophy,        color: "#C4963A", bg: "#C4963A22" },
  { id: "svg:Target",         label: "Goals",       Icon: Target,        color: "#ef4444", bg: "#ef444422" },
  { id: "svg:Zap",            label: "Productivity",Icon: Zap,           color: "#d97706", bg: "#d9770622" },
  // Creativity
  { id: "svg:Palette",        label: "Art",         Icon: Palette,       color: "#7c3aed", bg: "#7c3aed22" },
  { id: "svg:Music",          label: "Music",       Icon: Music,         color: "#7c3aed", bg: "#7c3aed22" },
  { id: "svg:Camera",         label: "Photography", Icon: Camera,        color: "#0891b2", bg: "#0891b222" },
  { id: "svg:Pencil",         label: "Creative",    Icon: Pencil,        color: "#db2777", bg: "#db277722" },
  { id: "svg:Sparkles",       label: "Magic",       Icon: Sparkles,      color: "#C4963A", bg: "#C4963A22" },
  // Community
  { id: "svg:Users",          label: "Community",   Icon: Users,         color: "#059669", bg: "#05966922" },
  { id: "svg:Globe",          label: "Global",      Icon: Globe,         color: "#059669", bg: "#05966922" },
  { id: "svg:Home",           label: "Home",        Icon: Home,          color: "#92644a", bg: "#92644a22" },
  { id: "svg:MessageCircle",  label: "Chat",        Icon: MessageCircle, color: "#3a7fe0", bg: "#3a7fe022" },
  { id: "svg:Handshake",      label: "Partnership", Icon: Handshake,     color: "#059669", bg: "#05966922" },
  // Lifestyle
  { id: "svg:Leaf",           label: "Nature",      Icon: Leaf,          color: "#4caf82", bg: "#4caf8222" },
  { id: "svg:Coffee",         label: "Coffee",      Icon: Coffee,        color: "#92644a", bg: "#92644a22" },
  { id: "svg:Utensils",       label: "Food",        Icon: Utensils,      color: "#e07d3a", bg: "#e07d3a22" },
  { id: "svg:Plane",          label: "Travel",      Icon: Plane,         color: "#0891b2", bg: "#0891b222" },
  { id: "svg:Mountain",       label: "Adventure",   Icon: Mountain,      color: "#4caf82", bg: "#4caf8222" },
  // Mindset
  { id: "svg:Brain",          label: "Mindset",     Icon: Brain,         color: "#8b5cf6", bg: "#8b5cf622" },
  { id: "svg:Star",           label: "Excellence",  Icon: Star,          color: "#C4963A", bg: "#C4963A22" },
  { id: "svg:Sun",            label: "Wellness",    Icon: Sun,           color: "#d97706", bg: "#d9770622" },
  { id: "svg:Compass",        label: "Direction",   Icon: Compass,       color: "#0891b2", bg: "#0891b222" },
  { id: "svg:Shield",         label: "Discipline",  Icon: Shield,        color: "#3a7fe0", bg: "#3a7fe022" },
];

// ─── Icon renderer (used by card + picker) ────────────────────────────────────

export function GroupIconDisplay({
  icon,
  size = "md",
  accent,
}: {
  icon: string | null | undefined;
  size?: "sm" | "md" | "lg";
  accent?: string;
}) {
  const dim = size === "sm" ? "h-10 w-10 text-2xl" : size === "lg" ? "h-20 w-20 text-5xl" : "h-14 w-14 text-3xl";
  const iconDim = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-10 w-10" : "h-7 w-7";
  const bg = accent ? `${accent}22` : "#C4963A22";
  const border = accent ? `1.5px solid ${accent}44` : "1.5px solid #C4963A44";
  const color = accent ?? "#C4963A";

  if (!icon || !icon.startsWith("svg:")) {
    return (
      <div
        className={cn("flex items-center justify-center rounded-2xl shadow-sm", dim)}
        style={{ background: bg, border }}
      >
        {icon ?? "⭐"}
      </div>
    );
  }

  const svgOption = SVG_OPTIONS.find((o) => o.id === icon);
  if (!svgOption) {
    return (
      <div
        className={cn("flex items-center justify-center rounded-2xl shadow-sm", dim)}
        style={{ background: bg, border }}
      >
        ⭐
      </div>
    );
  }

  const { Icon } = svgOption;
  return (
    <div
      className={cn("flex items-center justify-center rounded-2xl shadow-sm", dim)}
      style={{ background: svgOption.bg, border: `1.5px solid ${svgOption.color}44` }}
    >
      <Icon className={iconDim} style={{ color: svgOption.color }} />
    </div>
  );
}

// ─── Picker modal ─────────────────────────────────────────────────────────────

interface GroupIconPickerProps {
  groupId: string;
  currentIcon: string | null | undefined;
  onClose: () => void;
  onSaved: (icon: string) => void;
}

export function GroupIconPicker({ groupId, currentIcon, onClose, onSaved }: GroupIconPickerProps) {
  const [tab, setTab] = useState<"emoji" | "svg">("emoji");
  const [selected, setSelected] = useState<string>(currentIcon ?? "⭐");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon: selected }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast("Group icon updated!", "success");
      onSaved(selected);
      onClose();
    } catch {
      toast("Failed to update icon.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-cream-paper shadow-2xl sm:rounded-3xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-cream-dark" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="section-label text-gold">Group Icon</p>
            <h2 className="font-serif text-lg font-semibold text-ink">Choose an Icon</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-cream-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex justify-center py-3">
          <GroupIconDisplay icon={selected} size="lg" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-5 mb-3 rounded-xl bg-cream-dark/50 p-1">
          {(["emoji", "svg"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
                tab === t ? "bg-cream-paper text-ink shadow-sm" : "text-ink-muted"
              )}
            >
              {t === "emoji" ? "Emoji" : "SVG Icons"}
            </button>
          ))}
        </div>

        {/* Options grid */}
        <div className="mx-5 mb-5 max-h-56 overflow-y-auto rounded-2xl border border-cream-dark bg-cream-paper/60 p-3">
          {tab === "emoji" ? (
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelected(emoji)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl text-xl transition-all",
                    selected === emoji
                      ? "bg-gold/20 ring-2 ring-gold"
                      : "hover:bg-cream-dark"
                  )}
                >
                  {selected === emoji && (
                    <span className="absolute text-[0.5rem] text-gold"><Check className="h-2 w-2" /></span>
                  )}
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {SVG_OPTIONS.map((opt) => {
                const { Icon } = opt;
                const isSelected = selected === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelected(opt.id)}
                    title={opt.label}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl p-2 transition-all",
                      isSelected ? "ring-2 ring-gold bg-gold/10" : "hover:bg-cream-dark"
                    )}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: opt.bg }}
                    >
                      <Icon className="h-5 w-5" style={{ color: opt.color }} />
                    </div>
                    <p className="text-[0.55rem] text-ink-muted leading-none">{opt.label}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="px-5 pb-6">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="btn-gold w-full"
          >
            {saving ? "Saving…" : "Save Icon"}
          </button>
        </div>
      </div>
    </div>
  );
}
