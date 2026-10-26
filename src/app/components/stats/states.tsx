import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">Statistikani yuklab bo'lmadi</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RotateCw className="h-4 w-4" aria-hidden />
        Qayta urinish
      </Button>
    </div>
  );
}

export function EmptyState({ children = "Tanlangan filtrlar bo'yicha ma'lumot yo'q" }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Inbox className="h-5 w-5" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

/** Same footprint as the loaded dashboard, so nothing jumps when data arrives. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda" className="space-y-6" data-testid="dashboard-skeleton">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[104px] rounded-2xl" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[392px] rounded-2xl" />
        <Skeleton className="h-[392px] rounded-2xl" />
      </div>
      <Skeleton className="h-[392px] rounded-2xl" />
    </div>
  );
}
