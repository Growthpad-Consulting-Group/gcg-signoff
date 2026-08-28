import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Icon } from "@iconify/react";
import type { Editor, Range } from "@tiptap/core";

export interface SlashItem {
  id: string;
  label: string;
  icon: string;
  action: (editor: Editor, range: Range) => void;
}

export interface SlashCommandMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/** The popup list rendered by the "/" slash-command suggestion in RichTextEditor. Mounted
 * imperatively via Tiptap's ReactRenderer, not part of the normal React tree — arrow-key/Enter
 * navigation is delegated in from the Suggestion plugin's onKeyDown via the exposed ref. */
const SlashCommandMenu = forwardRef<SlashCommandMenuHandle, { items: SlashItem[]; command: (item: SlashItem) => void }>(
  function SlashCommandMenu({ items, command }, ref) {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((s) => (s - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          command(items[selected]);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return <div className="w-56 rounded-lg border border-app-border bg-surface p-2 text-xs text-text-lo shadow-lg">No matches</div>;
    }

    return (
      <div className="max-h-72 w-64 overflow-y-auto rounded-lg border border-app-border bg-surface p-1 shadow-lg">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => command(item)}
            onMouseEnter={() => setSelected(i)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              i === selected ? "bg-brand-500 text-white" : "text-text-hi hover:bg-surface-2"
            }`}
          >
            <Icon icon={item.icon} className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </div>
    );
  }
);

export default SlashCommandMenu;
