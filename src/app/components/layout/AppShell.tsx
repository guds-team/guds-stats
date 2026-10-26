import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { BarChart3, LogOut, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Radio, Sun } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../ui/sheet";
import { clearSession } from "../../lib/api";
import { clearOverviewCache } from "../../lib/useOverview";
import { useTheme, type ThemeChoice } from "../../lib/theme";

function readUser(): { phone_number?: string; email?: string } | null {
  try {
    return JSON.parse(localStorage.getItem("user") ?? "null");
  } catch {
    return null;
  }
}

export function endSession() {
  clearSession();
  clearOverviewCache(); // responses carry viewer-specific parts (admin_url)
}

const COLLAPSED_KEY = "sidebar_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

const NAV = [
  { to: "/", label: "Umumiy statistika", hint: "Davr bo'yicha ko'rsatkichlar", Icon: BarChart3, end: true },
  { to: "/live", label: "Jonli kuzatuv", hint: "Onlayn ishchilar va ishlar", Icon: Radio, end: false },
];

const THEMES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Yorug' mavzu", Icon: Sun },
  { value: "dark", label: "Qorong'i mavzu", Icon: Moon },
  { value: "system", label: "Tizim mavzusi", Icon: Monitor },
];

function ThemeSwitch({ vertical = false }: { vertical?: boolean }) {
  const { choice, choose } = useTheme();
  return (
    <div
      role="group"
      aria-label="Mavzu"
      className={`flex items-center rounded-lg border bg-background p-0.5 ${vertical ? "flex-col" : ""}`}
    >
      {THEMES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={choice === value}
          onClick={() => choose(value)}
          className={`grid h-7 flex-1 place-items-center rounded-md px-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            choice === value ? "bg-muted text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] text-sm font-bold text-white"
      >
        G
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">GUDS Stats</span>
          <span className="block text-[11px] text-muted-foreground">Analitika paneli</span>
        </span>
      )}
    </div>
  );
}

function NavItems({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Bo'limlar" className="space-y-1">
      {NAV.map(({ to, label, hint, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={compact ? label : undefined}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              compact ? "justify-center" : ""
            } ${
              isActive
                ? "bg-[var(--accent-brand-soft)] font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-[var(--accent-brand)]" />
              )}
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[var(--accent-brand)]" : ""}`} aria-hidden />
              {compact ? (
                <span className="sr-only">{label}</span>
              ) : (
                <span className="min-w-0">
                  <span className="block truncate">{label}</span>
                  <span className="block truncate text-[11px] font-normal text-muted-foreground">{hint}</span>
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Account({ compact, onLogout }: { compact?: boolean; onLogout: () => void }) {
  const user = readUser();
  const who = user?.phone_number ?? user?.email;
  return (
    <div className={`flex items-center gap-2 ${compact ? "flex-col" : ""}`}>
      {!compact && who && (
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={who}>
          {who}
        </span>
      )}
      <button
        type="button"
        onClick={onLogout}
        title="Chiqish"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        <span className={compact ? "sr-only" : ""}>Chiqish</span>
      </button>
    </div>
  );
}

/**
 * Signed-in layout: a sidebar (collapsible, remembered per browser) on
 * desktop, a top bar with a drawer on small screens. `status` sits in the top
 * bar next to the page (e.g. "updating", live connection state).
 */
export function AppShell({ status, children }: { status?: React.ReactNode; children: React.ReactNode }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const section = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {
        // storage unavailable: the choice lasts for this page only
      }
      return !c;
    });
  };

  const logout = () => {
    endSession();
    toast.success("Tizimdan chiqdingiz");
    navigate("/login");
  };

  return (
    <div className="app-backdrop min-h-screen lg:flex">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-[var(--sidebar-bg)] transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[68px]" : "w-60"
        }`}
      >
        <div className={`flex h-14 items-center border-b ${collapsed ? "justify-center" : "px-4"}`}>
          <Brand compact={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {!collapsed && (
            <p className="mb-2 px-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Bo'limlar</p>
          )}
          <NavItems compact={collapsed} />
        </div>
        <div className="space-y-3 border-t p-3">
          <ThemeSwitch vertical={collapsed} />
          <Account compact={collapsed} onLogout={logout} />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Yon panelni ochish" : "Yon panelni yig'ish"}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
            {!collapsed && "Yig'ish"}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Menyuni ochish"
              className="grid h-9 w-9 place-items-center rounded-lg border lg:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden />
            </button>
            <div className="lg:hidden">
              <Brand compact />
            </div>
            {section && (
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <span className="hidden text-muted-foreground lg:inline">GUDS Stats</span>
                <span className="hidden text-muted-foreground/60 lg:inline" aria-hidden>
                  /
                </span>
                <span className="truncate font-medium">{section.label}</span>
              </p>
            )}
            <div className="ml-auto flex items-center gap-2">{status}</div>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetTitle className="sr-only">Menyu</SheetTitle>
          <SheetDescription className="sr-only">Bo'limlar va hisob</SheetDescription>
          <div className="flex h-14 items-center border-b px-4">
            <Brand />
          </div>
          <div className="flex-1 p-3">
            <NavItems onNavigate={() => setDrawer(false)} />
          </div>
          <div className="space-y-3 border-t p-3">
            <ThemeSwitch />
            <Account onLogout={logout} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
