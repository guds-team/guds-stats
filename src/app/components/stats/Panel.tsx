import { useState } from "react";
import { BarChart3, Download, Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
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
    <Button variant="outline" size="sm" onClick={run} disabled={busy} aria-label={`${label}: CSV yuklab olish`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
      CSV
    </Button>
  );
}

export function Panel({ title, description, exportTable, params, chart, table, toolbar, className }: PanelProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const showing = chart ? view : "table";
  return (
    <Card className={className} aria-label={title} role="region">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {chart && (
            <div role="group" aria-label="Ko'rinish" className="inline-flex rounded-md border">
              <Button
                variant={showing === "chart" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={showing === "chart"}
                onClick={() => setView("chart")}
                className="rounded-r-none"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Grafik</span>
              </Button>
              <Button
                variant={showing === "table" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={showing === "table"}
                onClick={() => setView("table")}
                className="rounded-l-none"
              >
                <Table2 className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Jadval</span>
              </Button>
            </div>
          )}
          {exportTable && <CsvButton table={exportTable} params={params} label={title} />}
        </div>
      </CardHeader>
      <CardContent>{showing === "chart" ? chart : table}</CardContent>
    </Card>
  );
}
