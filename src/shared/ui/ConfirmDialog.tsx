"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/shared/contexts/ThemeContext";
import GlassPanel from "@/shared/ui/GlassPanel";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmIcon?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/** Same visual language as SimpleModal's built-in "unsaved changes" dialog, generalized for
 * any destructive/confirm action (e.g. delete) instead of browser confirm(). */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  confirmIcon = "solar:trash-bin-trash-broken",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { resolvedMode: mode } = useTheme();
  const [confirming, setConfirming] = useState(false);

  if (typeof document === "undefined") return null;

  const accentClass = variant === "danger" ? "text-status-danger" : "text-amber-500";
  const iconBg = variant === "danger" ? "bg-status-danger/10 border-status-danger/30" : "bg-amber-500/10 border-amber-500/30";
  const confirmButtonClass =
    variant === "danger"
      ? "bg-status-danger hover:bg-status-danger/90 shadow-status-danger/20"
      : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20";

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm();
    setConfirming(false);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            style={{ filter: "url(#glass-distortion)", backdropFilter: "blur(12px) saturate(180%)" }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/25"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassPanel mode={mode} className={`rounded-3xl overflow-hidden ${mode === "dark" ? "bg-gray-900/50" : "bg-white/50"}`}>
              <div className="p-8 flex flex-col items-center text-center">
                <div className={`mb-5 w-16 h-16 rounded-2xl border flex items-center justify-center ${iconBg}`}>
                  <Icon icon="solar:danger-triangle-bold-duotone" className={`w-8 h-8 ${accentClass}`} />
                </div>
                <h3 className={`text-lg font-semibold mb-1.5 ${mode === "dark" ? "text-white" : "text-gray-900"}`}>{title}</h3>
                <p className={`text-sm leading-relaxed mb-7 ${mode === "dark" ? "text-gray-400" : "text-gray-500"}`}>{message}</p>
                <div className="w-full flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={confirming}
                    className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl active:scale-[0.98] font-semibold text-sm transition-all backdrop-blur-md border ring-1 ring-inset ring-white/20 disabled:opacity-50 ${
                      mode === "dark" ? "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300" : "bg-white/40 hover:bg-white/60 border-white/40 text-gray-700"
                    }`}
                  >
                    {cancelLabel}
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.98] text-white font-semibold text-sm transition-all shadow-lg disabled:opacity-70 ${confirmButtonClass}`}
                  >
                    {confirming ? (
                      <Icon icon="solar:loading-bold" className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon icon={confirmIcon} className="w-4 h-4" />
                    )}
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
