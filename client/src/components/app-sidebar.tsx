import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Milk, Heart, Stethoscope, Leaf, Package, Wallet,
  Bell, BarChart3, Settings, ChevronUp, LogOut, CreditCard,
  Baby, Recycle, ArrowLeftRight,
} from "lucide-react";

const mainNavItems = [
  { title: "Dashboard",    url: "/",          icon: LayoutDashboard, color: "text-blue-500" },
  { title: "Cattle",       url: "/cattle",    icon: Heart,           color: "text-red-500" },
  { title: "Milk Records", url: "/milk",      icon: Milk,            color: "text-sky-500" },
  { title: "Breeding",     url: "/breeding",  icon: Baby,            color: "text-pink-500" },
  { title: "Health",       url: "/health",    icon: Stethoscope,     color: "text-emerald-500" },
  { title: "Feed",         url: "/feed",      icon: Leaf,            color: "text-lime-600" },
];

const managementNavItems = [
  { title: "Byproducts", url: "/byproducts",  icon: Recycle,   color: "text-teal-500" },
  { title: "Inventory",  url: "/inventory",   icon: Package,   color: "text-orange-500" },
  { title: "Finances",   url: "/finances",    icon: Wallet,    color: "text-yellow-600" },
  { title: "Reports",    url: "/reports",     icon: BarChart3, color: "text-violet-500" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: 60_000,
  });

  const alertCount = stats?.activeAlerts || 0;

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  return (
    <Sidebar className="border-r-0">
      {/* Brand Header */}
      <SidebarHeader className="p-0">
        <Link href="/">
          <div
            className="flex items-center gap-3 px-5 py-5 cursor-pointer group"
            data-testid="link-logo"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
              <Milk className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-sidebar-foreground leading-tight tracking-tight">
                DairyFlow
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
                Farm ERP
              </p>
            </div>
          </div>
        </Link>
        <div className="h-px bg-sidebar-border mx-4" />
      </SidebarHeader>

      <SidebarContent className="pt-2 px-2">
        {/* Main Nav */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground/70 mb-1">
            Farm
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {mainNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} className="h-9 rounded-lg">
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}
                        className="flex items-center gap-3 px-3"
                      >
                        <div className={`flex-shrink-0 ${active ? "text-primary" : item.color} opacity-90`}>
                          <item.icon className="w-[17px] h-[17px]" />
                        </div>
                        <span className="text-[13px] font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="h-px bg-sidebar-border mx-1 my-3" />

        {/* Management Nav */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground/70 mb-1">
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {managementNavItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} className="h-9 rounded-lg">
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}
                        className="flex items-center gap-3 px-3"
                      >
                        <div className={`flex-shrink-0 ${active ? "text-primary" : item.color} opacity-90`}>
                          <item.icon className="w-[17px] h-[17px]" />
                        </div>
                        <span className="text-[13px] font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="h-px bg-sidebar-border mx-1 my-3" />

        {/* Utility Nav */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/alerts")} className="h-9 rounded-lg">
                  <Link href="/alerts" data-testid="nav-alerts" className="flex items-center gap-3 px-3">
                    <Bell className={`w-[17px] h-[17px] flex-shrink-0 ${isActive("/alerts") ? "text-primary" : "text-amber-500"} opacity-90`} />
                    <span className="text-[13px] font-medium">Alerts</span>
                    {alertCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 min-w-[20px] text-[10px] px-1.5 rounded-full"
                      >
                        {alertCount > 99 ? "99+" : alertCount}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/billing")} className="h-9 rounded-lg">
                  <Link href="/billing" data-testid="nav-billing" className="flex items-center gap-3 px-3">
                    <CreditCard className={`w-[17px] h-[17px] flex-shrink-0 ${isActive("/billing") ? "text-primary" : "text-purple-500"} opacity-90`} />
                    <span className="text-[13px] font-medium">Billing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/import-export")} className="h-9 rounded-lg">
                  <Link href="/import-export" data-testid="nav-import-export" className="flex items-center gap-3 px-3">
                    <ArrowLeftRight className={`w-[17px] h-[17px] flex-shrink-0 ${isActive("/import-export") ? "text-primary" : "text-indigo-500"} opacity-90`} />
                    <span className="text-[13px] font-medium">Import / Export</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/settings")} className="h-9 rounded-lg">
                  <Link href="/settings" data-testid="nav-settings" className="flex items-center gap-3 px-3">
                    <Settings className={`w-[17px] h-[17px] flex-shrink-0 ${isActive("/settings") ? "text-primary" : "text-gray-500"} opacity-90`} />
                    <span className="text-[13px] font-medium">Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Footer */}
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-sidebar-accent cursor-pointer transition-colors group"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-primary/20">
                <AvatarImage src={user?.profileImageUrl || ""} alt={user?.firstName || "User"} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {getInitials(user?.firstName, user?.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer gap-2" data-testid="menu-settings">
                <Settings className="w-4 h-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing" className="cursor-pointer gap-2" data-testid="menu-billing">
                <CreditCard className="w-4 h-4" /> Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
              data-testid="menu-logout"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
