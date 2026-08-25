"use client";

import { useRef } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Icon } from "@iconify/react";
import { MERGE_TAGS } from "@/features/signatures/lib/mergeTags";
import { BLOCK_TYPE_META, MergeTagKey, SignatureBlock, SocialPlatform } from "@/features/signatures/lib/blocks";
import { insertAtCursor } from "@/shared/lib/insertAtCursor";

const inputClass =
  "rounded-lg border border-app-border bg-surface px-2.5 py-1.5 text-xs text-text-hi outline-none focus:ring-2 focus:ring-brand-500";

const SOCIAL_PLATFORMS: SocialPlatform[] = ["linkedin", "x", "instagram", "facebook", "youtube"];

function TagSelect({ value, onChange }: { value: MergeTagKey; onChange: (v: MergeTagKey) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as MergeTagKey)} className={inputClass}>
      {MERGE_TAGS.map((t) => (
        <option key={t.tag} value={t.field}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

function MergeTagChips({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <div className="mb-1.5 flex flex-wrap gap-1">
      {MERGE_TAGS.map((t) => (
        <button
          key={t.tag}
          type="button"
          onClick={() => onInsert(t.tag)}
          className="rounded-full border border-app-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-hi hover:bg-surface-2"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface BlockCardProps {
  block: SignatureBlock;
  onChange: (next: SignatureBlock) => void;
  onDelete: () => void;
}

export default function BlockCard({ block, onChange, onDelete }: BlockCardProps) {
  const dragControls = useDragControls();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const meta = BLOCK_TYPE_META[block.type];

  return (
    <Reorder.Item value={block} dragListener={false} dragControls={dragControls} className="rounded-xl border border-app-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onPointerDown={(e) => dragControls.start(e)}
            className="cursor-grab touch-none rounded p-1 text-text-lo hover:bg-surface-2 active:cursor-grabbing"
            title="Drag to reorder"
          >
            <Icon icon="solar:hamburger-menu-broken" className="h-4 w-4" />
          </button>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-text-hi">
            <Icon icon={meta.icon} className="h-4 w-4" />
            {meta.label}
          </span>
        </div>
        <button onClick={onDelete} className="rounded p-1 text-status-danger hover:bg-status-danger/10" title="Remove block">
          <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />
        </button>
      </div>

      {block.type === "profile" && (
        <div className="space-y-2 pl-6">
          <div className="flex items-center gap-2">
            <label className="w-20 shrink-0 text-xs text-text-lo">Photo URL</label>
            <input
              value={block.photoUrl}
              onChange={(e) => onChange({ ...block, photoUrl: e.target.value })}
              className={`${inputClass} flex-1`}
            />
            <label className="text-xs text-text-lo">Size</label>
            <input
              type="number"
              value={block.photoSize}
              onChange={(e) => onChange({ ...block, photoSize: Number(e.target.value) })}
              className={`${inputClass} w-16`}
            />
          </div>
          {block.lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <TagSelect value={line.tag} onChange={(tag) => onChange({ ...block, lines: block.lines.map((l, j) => (j === i ? { ...l, tag } : l)) })} />
              <input
                type="color"
                value={line.color || "#111827"}
                onChange={(e) => onChange({ ...block, lines: block.lines.map((l, j) => (j === i ? { ...l, color: e.target.value } : l)) })}
                className="h-7 w-9 rounded border border-app-border bg-surface"
              />
              <label className="flex items-center gap-1 text-xs text-text-lo">
                <input
                  type="checkbox"
                  checked={!!line.bold}
                  onChange={(e) => onChange({ ...block, lines: block.lines.map((l, j) => (j === i ? { ...l, bold: e.target.checked } : l)) })}
                />
                Bold
              </label>
            </div>
          ))}
        </div>
      )}

      {block.type === "contactRow" && (
        <div className="space-y-2 pl-6">
          {block.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <TagSelect value={item.tag} onChange={(tag) => onChange({ ...block, items: block.items.map((it, j) => (j === i ? { tag } : it)) })} />
              <button
                onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                className="rounded p-1 text-text-lo hover:bg-surface-2"
              >
                <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ ...block, items: [...block.items, { tag: "phone" }] })}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            + Add field
          </button>
        </div>
      )}

      {block.type === "text" && (
        <div className="space-y-2 pl-6">
          <MergeTagChips onInsert={(tag) => textareaRef.current && insertAtCursor(textareaRef.current, block.content, `{{${tag}}}`, (v) => onChange({ ...block, content: v }))} />
          <textarea
            ref={textareaRef}
            value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            rows={2}
            className={`${inputClass} w-full font-mono`}
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-lo">Size</label>
            <input type="number" value={block.fontSize} onChange={(e) => onChange({ ...block, fontSize: Number(e.target.value) })} className={`${inputClass} w-16`} />
            <input type="color" value={block.color} onChange={(e) => onChange({ ...block, color: e.target.value })} className="h-7 w-9 rounded border border-app-border bg-surface" />
            <label className="flex items-center gap-1 text-xs text-text-lo">
              <input type="checkbox" checked={block.bold} onChange={(e) => onChange({ ...block, bold: e.target.checked })} />
              Bold
            </label>
            <select value={block.align} onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" })} className={inputClass}>
              <option value="left">Left</option>
              <option value="center">Center</option>
            </select>
          </div>
        </div>
      )}

      {block.type === "divider" && (
        <div className="flex items-center gap-2 pl-6">
          <label className="text-xs text-text-lo">Color</label>
          <input type="color" value={block.color} onChange={(e) => onChange({ ...block, color: e.target.value })} className="h-7 w-9 rounded border border-app-border bg-surface" />
          <label className="text-xs text-text-lo">Thickness</label>
          <input type="number" value={block.thickness} onChange={(e) => onChange({ ...block, thickness: Number(e.target.value) })} className={`${inputClass} w-16`} />
        </div>
      )}

      {block.type === "spacer" && (
        <div className="flex items-center gap-2 pl-6">
          <label className="text-xs text-text-lo">Height (px)</label>
          <input type="number" value={block.height} onChange={(e) => onChange({ ...block, height: Number(e.target.value) })} className={`${inputClass} w-16`} />
        </div>
      )}

      {block.type === "socialIcons" && (
        <div className="space-y-2 pl-6">
          {block.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={item.platform}
                onChange={(e) => onChange({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, platform: e.target.value as SocialPlatform } : it)) })}
                className={inputClass}
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                value={item.url}
                onChange={(e) => onChange({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, url: e.target.value } : it)) })}
                placeholder="https://..."
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                className="rounded p-1 text-text-lo hover:bg-surface-2"
              >
                <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ ...block, items: [...block.items, { platform: "linkedin", url: "" }] })}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            + Add icon
          </button>
        </div>
      )}

      {block.type === "html" && (
        <div className="space-y-2 pl-6">
          <MergeTagChips onInsert={(tag) => textareaRef.current && insertAtCursor(textareaRef.current, block.html, `{{${tag}}}`, (v) => onChange({ ...block, html: v }))} />
          <textarea
            ref={textareaRef}
            value={block.html}
            onChange={(e) => onChange({ ...block, html: e.target.value })}
            spellCheck={false}
            rows={5}
            className={`${inputClass} w-full font-mono`}
          />
        </div>
      )}
    </Reorder.Item>
  );
}
