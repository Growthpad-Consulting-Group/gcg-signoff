export type NavItem = {
  href: string;
  icon: string;
  label: string;
};

export type NavGroup = {
  category: string;
  icon: string;
  items: NavItem[];
};

export const sidebarNavGroups: NavGroup[] = [
  {
    category: "Overview",
    icon: "solar:widget-2-broken",
    items: [{ href: "/overview", icon: "solar:widget-2-broken", label: "Dashboard" }],
  },
  {
    category: "Signatures",
    icon: "solar:pen-new-square-broken",
    items: [
      { href: "/templates", icon: "solar:pen-new-square-broken", label: "Templates" },
      { href: "/staff", icon: "solar:users-group-rounded-broken", label: "Staff" },
      { href: "/campaigns", icon: "solar:megaphone-broken", label: "Campaigns" },
      { href: "/analytics", icon: "solar:chart-broken", label: "Analytics" },
    ],
  },
  {
    category: "Settings",
    icon: "solar:settings-broken",
    items: [{ href: "/domains", icon: "solar:global-broken", label: "Domains" }],
  },
];

/** Flat list of every nav item, derived from the grouped structure — kept for lookups that don't care about grouping. */
export const sidebarNav: NavItem[] = sidebarNavGroups.flatMap((group) => group.items);
