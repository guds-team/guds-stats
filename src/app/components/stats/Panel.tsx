import { useState } from "react";
import { BarChart3, Download, Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { downloadCsv, type ExportTable } from "../../lib/csv";
import type { ApiParams } from "../../lib/filters";

interface PanelProps {
  title: string;
  description?: React.ReactNode;
  exportTable?: ExportTable;
  params: ApiParams;
  /** With both, the panel offers a chart / table switch. */
  chart?: React.ReactNode;
  table: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}

export function CsvButton({ table, params, label }: { table: ExportTable; params: ApiParams; label: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await downloadCsv(table, params);
    } catch (error) {
      toast.error(`CSV yuklab bo'lmadi: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 rounded-lg"
      onClick={run}
      disabled={busy}
      aria-label={`${label}: CSV yuklab olish`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
      CSV
    </Button>
  );
}

export function Panel({ title, description, exportTable, params, chart, table, toolbar, className }: PanelProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const showing = chart ? view : "table";
  return (
    <section
      aria-label={title}
      role="region"
      className={`flex flex-col rounded-xl border bg-card p-5 shadow-card sm:p-6 ${className ?? ""}`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64 space-y-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {chart && (
            <div role="group" aria-label="Ko'rinish" className="inline-flex rounded-lg border bg-muted/50 p-0.5">
              {(
                [
                  ["chart", "Grafik", BarChart3],
                  ["table", "Jadval", Table2],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={showing === key}
                  onClick={() => setView(key)}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                    showing === key ? "bg-background text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only sm:not-sr-only">{label}</span>
                </button>
              ))}
            </div>
          )}
          {exportTable && <CsvButton table={exportTable} params={params} label={title} />}
        </div>
      </div>
      <div className="min-w-0 flex-1">{showing === "chart" ? chart : table}</div>
    </section>
  );
}
