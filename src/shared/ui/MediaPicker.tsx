"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import SimpleModal from "@/shared/ui/SimpleModal";
import { createBrowserSupabaseClient } from "@/shared/lib/supabase/client";
import { PRODUCTION_APP_URL } from "@/features/signatures/lib/trackedLink";

// The same built-in icon sets blockSerializer.ts/BlockEditor.tsx reach for (contact rows, social
// rows) — shown here so swapping an existing icon block's image doesn't require re-adding the
// whole preset row just to pick a different one of these.
const CONTACT_ICONS = ["phone", "mobile", "location", "website"];
const SOCIAL_ICONS = ["linkedin", "instagram", "facebook", "x", "youtube"];
// PRODUCTION_APP_URL (not NEXT_PUBLIC_APP_URL) for the same reason CONTACT_ICON/SOCIAL_ICON use
// it elsewhere — this URL gets baked into the stored block the moment an icon is picked.
const contactIconUrl = (icon: string) => `${PRODUCTION_APP_URL}/assets/icons/contact/${icon}.png`;
const socialIconUrl = (icon: string) => `${PRODUCTION_APP_URL}/assets/icons/social/${icon}.png`;

const BUCKET = "signature-assets";
// Not a hard platform limit (Supabase Storage's own project cap is higher) — just a sane ceiling
// so a genuinely wrong file gets a clear error instead of a slow multi-minute upload attempt.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

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
  const [tab, setTab] = useState<"library" | "upload" | "icons">("library");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [dragOver, setDragOver] = useState(false);
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
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`That file is too large (${(file.size / 1024 / 1024).toFixed(0)}MB) — please compress it below 50MB first.`);
      return;
    }

    setUploading(true);
    try {
      // Upload straight to Supabase Storage from the browser via a signed URL, bypassing our
      // own Vercel function's 4.5MB request-body cap — otherwise a large file (a big GIF, a
      // raw photo export) would fail before our own upload code ever ran.
      setUploadStatus("Uploading…");
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!signRes.ok) throw new Error("Failed to prepare upload");
      const { path, token } = await signRes.json();

      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file);
      if (uploadError) throw uploadError;

      setUploadStatus("Finishing up…");
      // Compression itself now happens after this responds (see /api/uploads/finalize), so this
      // step is quick — it just registers the upload and hands back a URL.
      const finalizeRes = await fetch("/api/uploads/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, filename: file.name }),
      });
      if (!finalizeRes.ok) throw new Error("Failed to process upload");
      const { url } = await finalizeRes.json();
      select(url);
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
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
        <button
          onClick={() => setTab("icons")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "icons" ? "bg-brand-500 text-white" : "text-text-lo hover:text-text-hi"
          }`}
        >
          Icons
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

      {tab === "icons" && (
        <div className="max-h-96 space-y-4 overflow-y-auto">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Contact</p>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {CONTACT_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => select(contactIconUrl(icon))}
                  className="group flex flex-col items-center gap-1 rounded-lg border border-app-border p-2 transition-colors hover:border-brand-500"
                  title={icon}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- built-in icon, not a next/image-allowlisted upload */}
                  <img src={contactIconUrl(icon)} alt={icon} className="h-8 w-8" />
                  <span className="truncate text-xs text-text-lo group-hover:text-text-hi">{icon}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Social</p>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {SOCIAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => select(socialIconUrl(icon))}
                  className="group flex flex-col items-center gap-1 rounded-lg border border-app-border p-2 transition-colors hover:border-brand-500"
                  title={icon}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- built-in icon, not a next/image-allowlisted upload */}
                  <img src={socialIconUrl(icon)} alt={icon} className="h-8 w-8" />
                  <span className="truncate text-xs text-text-lo group-hover:text-text-hi">{icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "upload" && (
        <div
          className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragOver ? "border-brand-500 bg-brand-500/5" : "border-app-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) upload(file);
          }}
        >
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
            {uploading ? uploadStatus || "Uploading…" : "Choose a file"}
          </button>
          <p className="text-center text-xs text-text-lo">or drag and drop your image here</p>
          <p className="text-center text-xs text-text-lo">Large files (including GIFs) are automatically resized and compressed.</p>
        </div>
      )}
    </SimpleModal>
  );
}
