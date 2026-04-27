"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FriendCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  friendName?: string;
}

const CONFETTI_COLORS = ["#C4963A", "#E8C97A", "#86C07A", "#7AB5C4", "#C47A86", "#9B86C4"];

export function FriendCelebration({ isOpen, onClose, friendName }: FriendCelebrationProps) {
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(onClose, 3400);
    return () => clearTimeout(t);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Confetti */}
          <motion.div
            className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-sm"
                style={{
                  left: `${5 + (i * 5.5) % 90}%`,
                  width: i % 3 === 0 ? 10 : 6,
                  height: i % 3 === 0 ? 10 : 6,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                }}
                initial={{ y: "108vh", opacity: 1, rotate: 0 }}
                animate={{
                  y: "-10vh",
                  opacity: [1, 1, 0.7, 0],
                  rotate: 360 * (i % 2 === 0 ? 1 : -1),
                  x: [0, i % 2 === 0 ? 30 : -30, 0],
                }}
                transition={{
                  duration: 1.6 + (i % 5) * 0.1,
                  ease: "easeOut",
                  delay: (i % 4) * 0.04,
                }}
              />
            ))}
          </motion.div>

          {/* Toast */}
          <motion.div
            className="pointer-events-none fixed left-1/2 z-[90] w-full max-w-sm -translate-x-1/2 px-4"
            style={{ bottom: "calc(max(5.5rem, env(safe-area-inset-bottom, 0px) + 5rem))" }}
            initial={{ opacity: 0, y: 52, scale: 0.86 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ type: "spring", damping: 20, stiffness: 360 }}
          >
            <div
              className="overflow-hidden rounded-2xl border border-[#C4963A]/30 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
              style={{ background: "linear-gradient(135deg, #1f1c18 0%, #171411 100%)" }}
            >
              <div className="h-0.5 bg-gradient-to-r from-transparent via-[#C4963A]/60 to-transparent" />
              <div className="flex items-center gap-3.5 px-5 py-4">
                {/* SVG handshake / connection icon */}
                <motion.div
                  initial={{ scale: 0.4, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 10, stiffness: 280, delay: 0.08 }}
                >
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="20" fill="rgba(196,150,58,0.18)" />
                    {/* Two overlapping circles = connection */}
                    <circle cx="14" cy="20" r="7" fill="none" stroke="#E8C97A" strokeWidth="2" />
                    <circle cx="26" cy="20" r="7" fill="none" stroke="#C4963A" strokeWidth="2" />
                    <path d="M17 17 Q20 14 23 17" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    <path d="M17 23 Q20 26 23 23" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </motion.div>

                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base font-semibold text-white">
                    {friendName ? `Connected with ${friendName}!` : "New connection!"}
                  </p>
                  <p className="mt-0.5 text-sm leading-snug text-white/60">
                    You can now message and share goals.
                  </p>
                </div>
              </div>

              {/* Depleting progress bar */}
              <motion.div className="mx-4 mb-3 h-0.5 rounded-full" style={{ background: "rgba(196,150,58,0.2)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "#C4963A" }}
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 3.4, ease: "linear" }}
                />
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
