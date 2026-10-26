import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center shadow-card"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--delta-bad)]/10">
        <AlertTriangle className="h-5 w-5 text-[color:var(--delta-bad)]" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-medium">Statistikani yuklab bo'lmadi</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 rounded-lg">
        <RotateCw className="h-4 w-4" aria-hidden />
        Qayta urinish
      </Button>
    </div>
  );
}

export function EmptyState({
  children = "Tanlangan filtrlar bo'yicha ma'lumot yo'q",
  hint = "Davrni kengaytiring yoki filtrlarni o'zgartiring",
}: {
  children?: React.ReactNode;
  hint?: string | null;
}) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
        <Inbox className="h-4 w-4" aria-hidden />
      </span>
      <p className="font-medium text-foreground/80">{children}</p>
      {hint && <p className="text-xs">{hint}</p>}
    </div>
  );
}

/** Same footprint as the loaded dashboard, so nothing jumps when data arrives. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda" className="space-y-8" data-testid="dashboard-skeleton">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-xl" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[400px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    </div>
  );
}
