"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  streak?: number;
  isFirstCompletion?: boolean;
}

const CONFETTI_COLORS = ["#C4963A", "#E8C97A", "#86C07A", "#7AB5C4", "#C47A86", "#9B86C4"];

export function CelebrationModal({
  isOpen,
  onClose,
  title = "Great job!",
  message = "You completed your intention.",
  streak,
  isFirstCompletion,
}: CelebrationModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onClose, 3200);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Confetti layer */}
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${8 + (i * 6.5) % 84}%`,
                  width: i % 3 === 0 ? 8 : 5,
                  height: i % 3 === 0 ? 8 : 5,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                }}
                initial={{ y: "105vh", opacity: 1, rotate: 0, scale: 1 }}
                animate={{
                  y: "-15vh",
                  opacity: [1, 1, 0.8, 0],
                  rotate: 360 * (i % 2 === 0 ? 1 : -1),
                  x: [0, i % 2 === 0 ? 24 : -24, 0],
                  scale: [1, 1.2, 0.8],
                }}
                transition={{
                  duration: 1.4 + (i % 4) * 0.15,
                  ease: "easeOut",
                  delay: (i % 3) * 0.05,
                }}
              />
            ))}
          </motion.div>

          {/* Toast card */}
          <motion.div
            className="pointer-events-none fixed left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4"
            style={{ bottom: "calc(max(5.5rem, env(safe-area-inset-bottom, 0px) + 5rem))" }}
            initial={{ opacity: 0, y: 48, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ type: "spring", damping: 22, stiffness: 380 }}
          >
            <div
              className="overflow-hidden rounded-2xl border border-[#C4963A]/30 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
              style={{
                background: "linear-gradient(135deg, #1f1c18 0%, #171411 100%)",
              }}
            >
              {/* Gold accent top line */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-[#C4963A]/60 to-transparent" />

              <div className="flex items-start gap-3.5 px-5 py-4">
                <motion.div
                  className="mt-0.5 text-3xl leading-none"
                  initial={{ rotate: -20, scale: 0.5 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 12, stiffness: 300, delay: 0.1 }}
                >
                  🎉
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-white/65 leading-snug">{message}</p>

                  {streak && streak > 1 && (
                    <motion.p
                      className="mt-2 flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: "#E8C97A" }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      🔥 {streak}-day streak!
                    </motion.p>
                  )}

                  {streak === 1 || isFirstCompletion ? (
                    <motion.p
                      className="mt-1.5 text-xs text-white/45 italic leading-snug"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      Come back daily to build your streak.
                    </motion.p>
                  ) : null}
                </div>
              </div>

              {/* Progress bar that depletes over time */}
              <motion.div
                className="mx-4 mb-3 h-0.5 rounded-full"
                style={{ background: "rgba(196,150,58,0.25)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "#C4963A" }}
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 3.2, ease: "linear" }}
                />
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
