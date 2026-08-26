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

function iconFor(message: string): { icon: string; className: string } {
  const lower = message.toLowerCase();
  if (lower.includes("failed") || lower.includes("error")) {
    return { icon: "solar:danger-triangle-broken", className: "text-status-danger" };
  }
  if (lower.includes("updated") || lower.includes("redeploy")) {
    return { icon: "solar:refresh-circle-broken", className: "text-status-info" };
  }
  return { icon: "solar:bell-broken", className: "text-text-lo" };
}

export default function RecentActivity() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((res) => setNotifications(res.notifications || []))
      .catch(() => setNotifications([]));
  }, []);

  if (notifications === null) return null;

  if (notifications.length === 0) {
    return <p className="text-sm text-text-lo">No recent activity yet - deploy failures and template saves will show up here.</p>;
  }

  return (
    <ul className="space-y-3">
      {notifications.map((n) => {
        const { icon, className } = iconFor(n.message);
        return (
          <li key={n.id} className="flex items-start gap-3">
            <Icon icon={icon} className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} />
            <div className="min-w-0">
              <p className="text-sm text-text-hi">{n.message}</p>
              <p className="text-xs text-text-lo">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
