export const tenantRoles = ["admin", "manager", "accountant", "supervisor", "veterinarian", "worker", "viewer"] as const;
export type TenantRole = typeof tenantRoles[number];

export const permissionCatalog = [
  { key: "dashboard.view", label: "View dashboard", group: "Dashboard" },
  { key: "cattle.view", label: "View cattle", group: "Cattle" },
  { key: "cattle.manage", label: "Manage cattle", group: "Cattle" },
  { key: "milk.view", label: "View milk records", group: "Milk" },
  { key: "milk.manage", label: "Manage milk records", group: "Milk" },
  { key: "breeding.view", label: "View breeding", group: "Breeding" },
  { key: "breeding.manage", label: "Manage breeding", group: "Breeding" },
  { key: "health.view", label: "View health records", group: "Health" },
  { key: "health.manage", label: "Manage health records", group: "Health" },
  { key: "feed.view", label: "View feed", group: "Feed" },
  { key: "feed.manage", label: "Manage feed", group: "Feed" },
  { key: "inventory.view", label: "View inventory", group: "Inventory" },
  { key: "inventory.manage", label: "Manage inventory", group: "Inventory" },
  { key: "finances.view", label: "View finances", group: "Finances" },
  { key: "finances.manage", label: "Manage finances", group: "Finances" },
  { key: "byproducts.view", label: "View byproducts", group: "Byproducts" },
  { key: "byproducts.manage", label: "Manage byproducts", group: "Byproducts" },
  { key: "tasks.view", label: "View tasks", group: "Tasks" },
  { key: "tasks.manage", label: "Manage tasks", group: "Tasks" },
  { key: "alerts.view", label: "View alerts", group: "Alerts" },
  { key: "reports.view", label: "View reports", group: "Reports" },
  { key: "settings.manage", label: "Manage farm settings", group: "Administration" },
  { key: "team.manage", label: "Manage users and roles", group: "Administration" },
  { key: "billing.manage", label: "Manage billing", group: "Administration" },
  { key: "import_export.manage", label: "Import and export data", group: "Administration" },
] as const;

export type TenantPermission = typeof permissionCatalog[number]["key"];
export const allTenantPermissions = permissionCatalog.map(item => item.key) as TenantPermission[];

const operationalView: TenantPermission[] = [
  "dashboard.view", "cattle.view", "milk.view", "breeding.view", "health.view", "feed.view",
  "inventory.view", "byproducts.view", "tasks.view", "alerts.view",
];

export const rolePermissions: Record<TenantRole, TenantPermission[]> = {
  admin: allTenantPermissions,
  manager: [...operationalView, "cattle.manage", "milk.manage", "breeding.manage", "health.manage", "feed.manage", "inventory.manage", "byproducts.manage", "tasks.manage", "finances.view", "reports.view"],
  accountant: [...operationalView, "finances.view", "finances.manage", "reports.view"],
  supervisor: [...operationalView, "cattle.manage", "milk.manage", "breeding.manage", "health.manage", "feed.manage", "inventory.manage", "tasks.manage", "finances.view", "reports.view"],
  veterinarian: ["dashboard.view", "cattle.view", "breeding.view", "breeding.manage", "health.view", "health.manage", "tasks.view", "tasks.manage", "alerts.view"],
  worker: ["dashboard.view", "cattle.view", "milk.view", "milk.manage", "breeding.view", "health.view", "feed.view", "feed.manage", "inventory.view", "tasks.view", "tasks.manage", "alerts.view"],
  viewer: operationalView,
};

export const roleLabels: Record<TenantRole, string> = {
  admin: "Admin",
  manager: "Manager",
  accountant: "Accountant",
  supervisor: "Supervisor",
  veterinarian: "Veterinarian",
  worker: "Worker",
  viewer: "Viewer",
};

export function effectivePermissions(role: string, overrides?: string[] | null): TenantPermission[] {
  if (role === "owner" || role === "admin") return allTenantPermissions;
  if (overrides?.length) return overrides.filter((item): item is TenantPermission => allTenantPermissions.includes(item as TenantPermission));
  return rolePermissions[role as TenantRole] || [];
}
