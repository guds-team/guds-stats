import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Lock, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiHeaders, apiUrl } from "../lib/api";
import { LanguageSwitch } from "../components/layout/LanguageSwitch";

export function LoginPage() {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Only a path on this site (not "//host" or a full URL) is followed after login.
  const next = searchParams.get("next") ?? "/";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow digits, max 9 digits after +998
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 9) {
      setPhoneNumber(digits);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phoneNumber.length !== 9) {
      toast.error(t("auth.errors.phoneIncomplete"));
      return;
    }

    if (!password) {
      toast.error(t("auth.errors.passwordRequired"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/v1/users/auth/simple/login/"), {
        method: "POST",
        // The API answers its messages (e.g. wrong password) in the interface language.
        headers: apiHeaders({ "Content-Type": "application/json" }, false),
        body: JSON.stringify({
          phone_number: `998${phoneNumber}`,
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Login failed:", errorData);
        toast.error(errorData.message || t("auth.errors.invalidCredentials"));
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success && data.data.access) {
        // Save tokens to localStorage
        localStorage.setItem("access_token", data.data.access);
        localStorage.setItem("refresh_token", data.data.refresh);
        localStorage.setItem("user", JSON.stringify(data.data.user));

        toast.success(t("auth.success"));
        navigate(destination, { replace: true });
      } else {
        toast.error(t("auth.errors.invalidCredentials"));
      }
    } catch (error) {
      console.error("Login error:", error);
      
      // Check if it's a CORS or network error
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        toast.error(t("auth.errors.network"));
      } else {
        toast.error(t("auth.errors.generic", { message: (error as Error).message }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-backdrop relative flex min-h-screen items-center justify-center p-4">
      <LanguageSwitch className="absolute top-4 right-4 w-[120px]" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] text-lg font-bold text-white"
          >
            G
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{t("app.name")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.subtitle")}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-pop">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("auth.phone")}</Label>
              <div className="relative">
                <Phone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <div className="absolute top-1/2 left-9 -translate-y-1/2 text-sm text-muted-foreground">+998</div>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="90 900 90 90"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className="h-10 rounded-lg pl-[4.75rem]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 rounded-lg pl-9"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="h-10 w-full rounded-lg" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  {t("common.loadingEllipsis")}
                </span>
              ) : (
                t("auth.submit")
              )}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">{t("auth.demo")}</p>
      </div>
    </div>
  );
}
