"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import SimpleModal from "@/shared/ui/SimpleModal";

interface MediaAsset {
  id: string;
  public_url: string;
  filename: string | null;
  created_at: string;
}

export default function MediaPicker({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/media")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("request failed"))))
      .then((body) => setAssets(body.assets || []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const select = (url: string) => {
    onSelect(url);
    onClose();
  };

  const upload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("files", file);
    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      toast.error("Failed to upload image");
      return;
    }
    const { data } = await res.json();
    if (data?.[0]) select(data[0]);
  };

  return (
    <SimpleModal isOpen={isOpen} onClose={onClose} title="Choose an image" width="max-w-2xl">
      <div className="mb-4 inline-flex rounded-lg border border-app-border bg-surface p-1">
        <button
          onClick={() => setTab("library")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "library" ? "bg-brand-500 text-white" : "text-text-lo hover:text-text-hi"
          }`}
        >
          Media library
        </button>
        <button
          onClick={() => setTab("upload")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "upload" ? "bg-brand-500 text-white" : "text-text-lo hover:text-text-hi"
          }`}
        >
          Upload new
        </button>
      </div>

      {tab === "library" && (
        <>
          {loading ? (
            <div className="flex justify-center py-8">
              <Icon icon="solar:loading-bold" className="h-6 w-6 animate-spin text-text-lo" />
            </div>
          ) : assets.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-lo">No images uploaded yet — switch to "Upload new".</p>
          ) : (
            <div className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => select(asset.public_url)}
                  className="group overflow-hidden rounded-lg border border-app-border transition-colors hover:border-brand-500"
                  title={asset.filename || undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded image, not from next/image-allowlisted hosts */}
                  <img src={asset.public_url} alt={asset.filename || "Uploaded image"} className="h-20 w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "upload" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-surface px-4 py-2 text-sm font-medium text-text-hi transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {uploading ? <Icon icon="solar:loading-bold" className="h-4 w-4 animate-spin" /> : <Icon icon="solar:gallery-add-broken" className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Choose a file"}
          </button>
        </div>
      )}
    </SimpleModal>
  );
}
