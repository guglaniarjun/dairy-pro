import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Heart, Milk, Baby, Bell } from "lucide-react";

const navItems = [
  { title: "Home",     url: "/",         icon: LayoutDashboard, exact: true },
  { title: "Cattle",   url: "/cattle",   icon: Heart },
  { title: "Milk",     url: "/milk",     icon: Milk },
  { title: "Breeding", url: "/breeding", icon: Baby },
  { title: "Alerts",   url: "/alerts",   icon: Bell },
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
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Top border with subtle gradient */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div
        className="flex items-center justify-around px-2 pt-1 pb-2"
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          background: "hsl(var(--background) / 0.92)",
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.url, item.exact);
          return (
            <Link key={item.url} href={item.url}>
              <div
                className="flex flex-col items-center gap-0.5 px-4 py-1.5 relative"
                data-testid={`mobile-nav-${item.title.toLowerCase()}`}
              >
                {/* Active pill background */}
                {active && (
                  <div
                    className="absolute inset-x-1 inset-y-0 rounded-2xl"
                    style={{ background: "hsl(var(--primary) / 0.12)" }}
                  />
                )}

                {/* Icon */}
                <div className="relative z-10">
                  <item.icon
                    className={`w-[22px] h-[22px] transition-all duration-150 ${
                      active
                        ? "text-primary scale-110"
                        : "text-muted-foreground/70"
                    }`}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  {/* Alert badge */}
                  {item.url === "/alerts" && alertCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold px-1 shadow">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-[9px] font-semibold tracking-wide z-10 transition-colors duration-150 ${
                    active ? "text-primary" : "text-muted-foreground/60"
                  }`}
                >
                  {item.title}
                </span>

                {/* Active dot indicator */}
                {active && (
                  <div
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: "hsl(var(--primary))" }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
