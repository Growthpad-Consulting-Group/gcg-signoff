"use client";

import { useEffect, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { Icon } from "@iconify/react";
import { BLOCK_TYPE_META, SignatureBlock, createBlock } from "@/features/signatures/lib/blocks";
import BlockCard from "./BlockCard";

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_META) as SignatureBlock["type"][];

interface BlockListProps {
  blocks: SignatureBlock[];
  onChange: (blocks: SignatureBlock[]) => void;
}

export default function BlockList({ blocks, onChange }: BlockListProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const addBlock = (type: SignatureBlock["type"]) => {
    onChange([...blocks, createBlock(type)]);
    setMenuOpen(false);
  };

  return (
    <div>
      <Reorder.Group axis="y" values={blocks} onReorder={onChange} className="space-y-2">
        {blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            onChange={(next) => onChange(blocks.map((b) => (b.id === block.id ? next : b)))}
            onDelete={() => onChange(blocks.filter((b) => b.id !== block.id))}
          />
        ))}
      </Reorder.Group>

      <div ref={menuRef} className="relative mt-3">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-app-border py-2.5 text-sm font-medium text-text-lo hover:bg-surface-2 hover:text-text-hi"
        >
          <Icon icon="solar:add-circle-broken" className="h-4 w-4" />
          Add block
        </button>

        {menuOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-app-border bg-surface shadow-lg">
            {BLOCK_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => addBlock(type)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-hi hover:bg-surface-2"
              >
                <Icon icon={BLOCK_TYPE_META[type].icon} className="h-4 w-4" />
                {BLOCK_TYPE_META[type].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
