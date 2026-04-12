"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface StatInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  stat: {
    title: string;
    description: string;
    value?: string;
    visual?: React.ReactNode;
  } | null;
}

export function StatInfoModal({ isOpen, onClose, stat }: StatInfoModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen || !stat) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl border border-[#C4963A]/20 bg-gradient-to-br from-[#1f1c1a] to-[#171411] shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Accent line at top */}
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#C4963A]/40 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
            <h2 className="font-serif text-2xl font-semibold text-white">
              {stat.title}
            </h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/8 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6 px-6 py-6">
            {/* Visual if provided */}
            {stat.visual && (
              <div className="flex items-center justify-center rounded-xl border border-white/5 bg-white/2 p-6">
                {stat.visual}
              </div>
            )}

            {/* Value if provided */}
            {stat.value && (
              <div className="text-center">
                <p className="font-serif text-5xl font-bold bg-gradient-to-r from-[#E8C97A] to-[#C4963A] bg-clip-text text-transparent">
                  {stat.value}
                </p>
              </div>
            )}

            {/* Description */}
            <p className="text-sm leading-relaxed text-white/65 font-light">
              {stat.description}
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-gradient-to-r from-[#C4963A]/40 to-[#C4963A]/20 px-4 py-2.5 font-semibold text-[#E8C97A] transition-all hover:from-[#C4963A]/50 hover:to-[#C4963A]/30 hover:text-white border border-[#C4963A]/20"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
