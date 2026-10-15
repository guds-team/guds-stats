import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Lock, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "../lib/api";

export function LoginPage() {
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
      toast.error("Telefon raqami to'liq emas");
      return;
    }

    if (!password) {
      toast.error("Parolni kiriting");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/v1/users/auth/simple/login/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: `998${phoneNumber}`,
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Login failed:", errorData);
        toast.error(errorData.message || "Login yoki parol noto'g'ri");
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success && data.data.access) {
        // Save tokens to localStorage
        localStorage.setItem("access_token", data.data.access);
        localStorage.setItem("refresh_token", data.data.refresh);
        localStorage.setItem("user", JSON.stringify(data.data.user));

        toast.success("Muvaffaqiyatli kirdingiz!");
        navigate(destination, { replace: true });
      } else {
        toast.error("Login yoki parol noto'g'ri");
      }
    } catch (error) {
      console.error("Login error:", error);
      
      // Check if it's a CORS or network error
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        toast.error("Server bilan bog'lanishda xatolik. CORS muammosi bo'lishi mumkin.");
      } else {
        toast.error("Xatolik yuz berdi: " + (error as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Tizimga kirish</CardTitle>
          <CardDescription>
            Statistika paneliga kirish uchun ma'lumotlaringizni kiriting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon raqami</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <div className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  +998
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="90 900 90 90"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className="pl-20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Yuklanmoqda...
                </div>
              ) : (
                "Kirish"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Demo: +998 90 900 90 90</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}