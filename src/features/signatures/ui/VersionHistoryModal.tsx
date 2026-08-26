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
          <ul className="space-y-2">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg border border-app-border bg-surface-2 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-text-hi">
                  <Icon icon="solar:history-broken" className="h-4 w-4 text-text-lo" />
                  {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                </span>
                <button
                  onClick={() => setRestoreTarget(v)}
                  className="text-xs font-medium text-brand-600 hover:underline"
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
