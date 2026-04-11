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
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1714] shadow-xl animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-white/5 p-5 sm:p-6">
            <h2 className="font-serif text-xl font-semibold text-white">
              {stat.title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 sm:p-6">
            {/* Visual if provided */}
            {stat.visual && (
              <div className="mb-4 flex items-center justify-center">
                {stat.visual}
              </div>
            )}

            {/* Value if provided */}
            {stat.value && (
              <div className="mb-4 text-center">
                <p className="text-4xl font-bold text-[#E8C97A]">
                  {stat.value}
                </p>
              </div>
            )}

            {/* Description */}
            <p className="text-sm leading-relaxed text-white/70">
              {stat.description}
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-5 py-3 sm:px-6 sm:py-4">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-white/8 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/12"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
