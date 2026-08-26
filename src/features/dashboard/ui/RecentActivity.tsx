"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Icon } from "@iconify/react";

interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

function iconFor(message: string): { icon: string; className: string; bg: string } {
  const lower = message.toLowerCase();
  if (lower.includes("failed") || lower.includes("error")) {
    return { icon: "solar:danger-triangle-broken", className: "text-status-danger", bg: "bg-status-danger/10" };
  }
  if (lower.includes("updated") || lower.includes("redeploy")) {
    return { icon: "solar:refresh-circle-broken", className: "text-status-info", bg: "bg-status-info/10" };
  }
  return { icon: "solar:bell-broken", className: "text-text-lo", bg: "bg-surface-2" };
}

export default function RecentActivity() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    fetch("/api/notifications?limit=20")
      .then((r) => r.json())
      .then((res) => setNotifications(res.notifications || []))
      .catch(() => setNotifications([]));
  }, []);

  if (notifications === null) return null;

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Icon icon="solar:bell-off-broken" className="h-6 w-6 text-text-lo" />
        <p className="text-sm text-text-lo">No recent activity yet — deploy failures and template saves will show up here.</p>
      </div>
    );
  }

  return (
    <ul className="-mx-2 max-h-80 divide-y divide-app-border overflow-y-auto">
      {notifications.map((n) => {
        const { icon, className, bg } = iconFor(n.message);
        return (
          <li key={n.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bg}`}>
              <Icon icon={icon} className={`h-3.5 w-3.5 ${className}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm leading-snug ${n.read ? "text-text-lo" : "text-text-hi"}`}>{n.message}</p>
              <p className="mt-0.5 text-xs text-text-lo">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </div>
            {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" title="Unread" />}
          </li>
        );
      })}
    </ul>
  );
}
