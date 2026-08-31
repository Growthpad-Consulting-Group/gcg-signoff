"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import SimpleModal from "@/shared/ui/SimpleModal";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";

interface Version {
  id: string;
  created_at: string;
}

interface VersionHistoryModalProps {
  templateId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export default function VersionHistoryModal({ templateId, isOpen, onClose, onRestored }: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Version | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setVersions(null);
    fetch(`/api/templates/${templateId}/versions`)
      .then((r) => r.json())
      .then((res) => setVersions(res.versions || []))
      .catch(() => setVersions([]));
  }, [isOpen, templateId]);

  const restore = async () => {
    if (!restoreTarget) return;
    const res = await fetch(`/api/templates/${templateId}/versions/${restoreTarget.id}/restore`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to restore version");
      return;
    }
    toast.success("Version restored");
    setRestoreTarget(null);
    onRestored();
    onClose();
  };

  return (
    <>
      <SimpleModal isOpen={isOpen} onClose={onClose} title="Version history" width="max-w-md">
        {versions === null && <p className="text-sm text-text-lo">Loading…</p>}
        {versions !== null && versions.length === 0 && (
          <p className="text-sm text-text-lo">No saved versions yet — versions are captured each time you click Save.</p>
        )}
        {versions !== null && versions.length > 0 && (
          // Capped height + its own scroll region — this list has no upper bound (a version is
          // snapshotted on every save), so left unconstrained the modal itself just grew taller
          // and taller instead of scrolling.
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {versions.map((v, i) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-app-border bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface"
              >
                <span className="flex items-center gap-2.5 text-sm text-text-hi">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
                    <Icon icon="solar:history-broken" className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex flex-col">
                    <span>{formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}</span>
                    {i === 0 && <span className="text-xs text-text-lo">Most recent</span>}
                  </span>
                </span>
                <button
                  onClick={() => setRestoreTarget(v)}
                  className="shrink-0 rounded-lg border border-app-border px-2.5 py-1.5 text-xs font-medium text-text-hi transition-colors hover:border-brand-500 hover:text-brand-600"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </SimpleModal>

      <ConfirmDialog
        isOpen={!!restoreTarget}
        title="Restore this version?"
        message="Your current state will be saved as a version too, so nothing is lost — this just makes the older version the live one."
        confirmLabel="Restore"
        confirmIcon="solar:history-broken"
        variant="warning"
        onConfirm={restore}
        onClose={() => setRestoreTarget(null)}
      />
    </>
  );
}
