import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Heart, Milk, Baby, Bell } from "lucide-react";

const navItems = [
  { title: "Home", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Cattle", url: "/cattle", icon: Heart },
  { title: "Milk", url: "/milk", icon: Milk },
  { title: "Breeding", url: "/breeding", icon: Baby },
  { title: "Alerts", url: "/alerts", icon: Bell },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: 60_000,
  });

  const alertCount = stats?.activeAlerts || 0;

  const isActive = (url: string, exact?: boolean) => {
    if (exact) return location === url;
    return location.startsWith(url);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const active = isActive(item.url, item.exact);
          return (
            <Link key={item.url} href={item.url}>
              <div
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors relative ${
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`mobile-nav-${item.title.toLowerCase()}`}
              >
                <div className="relative">
                  <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                  {item.url === "/alerts" && alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium leading-none ${active ? "text-primary" : ""}`}>{item.title}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
