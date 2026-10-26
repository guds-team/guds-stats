import { NavLink, useNavigate } from "react-router";
import { BarChart3, LogOut, Monitor, Moon, Radio, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
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

const THEMES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Yorug' mavzu", Icon: Sun },
  { value: "dark", label: "Qorong'i mavzu", Icon: Moon },
  { value: "system", label: "Tizim mavzusi", Icon: Monitor },
];

function ThemeSwitch() {
  const { choice, choose } = useTheme();
  return (
    <div role="group" aria-label="Mavzu" className="hidden items-center rounded-full border bg-card/60 p-0.5 sm:flex">
      {THEMES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={choice === value}
          onClick={() => choose(value)}
          className={`grid h-7 w-7 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            choice === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

const NAV = [
  { to: "/", label: "Statistika", Icon: BarChart3, end: true },
  { to: "/live", label: "Jonli kuzatuv", Icon: Radio, end: false },
];

/** Sticky top bar (brand, sections, theme, account) above every signed-in page. */
export function AppShell({ status, children }: { status?: React.ReactNode; children: React.ReactNode }) {
  const navigate = useNavigate();
  const user = readUser();

  const logout = () => {
    endSession();
    toast.success("Tizimdan chiqdingiz");
    navigate("/login");
  };

  return (
    <div className="app-backdrop min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] text-sm font-bold text-white shadow-sm"
            >
              G
            </span>
            <span className="hidden font-semibold tracking-tight md:inline">GUDS Stats</span>
          </div>
          <nav aria-label="Bo'limlar" className="ml-1 flex items-center gap-1 sm:ml-4">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(" ")[0]}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {status}
            <ThemeSwitch />
            {user && (
              <span className="hidden text-sm text-muted-foreground lg:inline">{user.phone_number ?? user.email}</span>
            )}
            <Button variant="outline" size="sm" onClick={logout} className="gap-2 rounded-full">
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Chiqish</span>
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
