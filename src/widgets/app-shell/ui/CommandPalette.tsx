"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { sidebarNav } from "@/shared/lib/nav";
import { NAV_SHORTCUTS } from "@/widgets/app-shell/lib/shortcuts";
import { useCommandPalette } from "@/shared/contexts/CommandPaletteContext";

const RESULT_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

interface StaffResult {
  id: string;
  full_name: string;
  email: string;
}

interface TemplateResult {
  id: string;
  name: string;
}

/** ⌘K command palette — jump between sections, or search live across staff and templates. */
export default function CommandPalette() {
  const { isOpen: open, close } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [staff, setStaff] = useState<StaffResult[]>([]);
  const [templates, setTemplates] = useState<TemplateResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setStaff([]);
      setTemplates([]);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setStaff([]);
      setTemplates([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const qs = `query=${encodeURIComponent(trimmed)}`;
        const [staffRes, templatesRes] = await Promise.all([
          fetch(`/api/staff?${qs}`, { signal: controller.signal }),
          fetch(`/api/templates?${qs}`, { signal: controller.signal }),
        ]);
        const [staffData, templatesData] = await Promise.all([staffRes.json(), templatesRes.json()]);
        setStaff((staffData.staff || []).slice(0, RESULT_LIMIT));
        setTemplates((templatesData.templates || []).slice(0, RESULT_LIMIT));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setStaff([]);
          setTemplates([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    router.push(href);
    close();
  };

  if (!open) return null;

  const isSearchMode = query.trim().length >= MIN_QUERY_LENGTH;
  const hasResults = staff.length > 0 || templates.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={() => close()}
    >
      <Command
        className="w-full max-w-lg overflow-hidden rounded-lg border border-app-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        shouldFilter={!isSearchMode}
      >
        <div className="flex items-center gap-2 border-b border-app-border px-3">
          <Icon icon={isSearching ? "mdi:loading" : "solar:magnifer-broken"} width={16} className={`text-text-lo ${isSearching ? "animate-spin" : ""}`} />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Jump to a section, search staff/templates…"
            className="h-11 flex-1 bg-transparent text-sm text-text-hi outline-none placeholder:text-text-lo"
          />
        </div>
        <Command.List className="max-h-96 overflow-y-auto p-2">
          {isSearchMode ? (
            <>
              {!isSearching && !hasResults && (
                <Command.Empty className="px-2 py-6 text-center text-sm text-text-lo">No matches for &quot;{query.trim()}&quot;.</Command.Empty>
              )}
              {staff.length > 0 && (
                <Command.Group heading="Staff" className={groupHeadingClass}>
                  {staff.map((person) => (
                    <Command.Item
                      key={`staff-${person.id}`}
                      value={`staff-${person.id}`}
                      onSelect={() => go(`/staff?id=${person.id}`)}
                      className={itemClass}
                    >
                      <Icon icon="solar:user-broken" width={16} className="text-text-lo" />
                      <span className="flex-1 truncate">{person.full_name}</span>
                      <span className="truncate text-xs text-text-lo/70">{person.email}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {templates.length > 0 && (
                <Command.Group heading="Templates" className={groupHeadingClass}>
                  {templates.map((template) => (
                    <Command.Item
                      key={`template-${template.id}`}
                      value={`template-${template.id}`}
                      onSelect={() => go(`/templates/${template.id}`)}
                      className={itemClass}
                    >
                      <Icon icon="solar:pen-new-square-broken" width={16} className="text-text-lo" />
                      <span className="flex-1 truncate">{template.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </>
          ) : (
            <>
              <Command.Empty className="px-2 py-6 text-center text-sm text-text-lo">No results.</Command.Empty>
              <Command.Group heading="Go to" className={groupHeadingClass}>
                {sidebarNav.map((item) => (
                  <Command.Item key={item.href} value={item.label} onSelect={() => go(item.href)} className={itemClass}>
                    <Icon icon={item.icon} width={16} className="text-text-lo" />
                    <span className="flex-1">{item.label}</span>
                    {NAV_SHORTCUTS[item.href] && (
                      <span className="font-mono text-[10px] uppercase text-text-lo/70">G {NAV_SHORTCUTS[item.href]}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            </>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

const groupHeadingClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-text-lo";

const itemClass = "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-text-hi data-[selected=true]:bg-surface-2";
