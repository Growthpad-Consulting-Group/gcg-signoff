"use client";

import { ReactNode, Ref, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export interface SlideoverHandle {
  close: () => void;
}

interface SlideoverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  ref?: Ref<SlideoverHandle>;
}

export default function Slideover({ isOpen, onClose, title, children, ref }: SlideoverProps) {
  useImperativeHandle(ref, () => ({
    close: onClose,
  }));

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20"
          />
          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed right-0 top-0 z-50 h-screen w-full max-w-sm overflow-y-auto bg-surface shadow-2xl flex flex-col"
          >
            <div className="sticky top-0 border-b border-app-border bg-surface px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-hi">{title}</h2>
              <button
                onClick={onClose}
                className="text-text-lo hover:text-text-hi transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
