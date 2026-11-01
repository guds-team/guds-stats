import { useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EXPORT_TABLES, downloadCsv, type ExportTable } from "../../lib/csv";
import type { ApiParams } from "../../lib/filters";

/** Every CSV the API can export, for the filters on screen (each panel also has its own button). */
export function ExportMenu({ params }: { params: ApiParams }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<ExportTable | null>(null);
  const run = async (table: ExportTable) => {
    setBusy(table);
    try {
      await downloadCsv(table, params);
    } catch (error) {
      toast.error(t("export.failed", { message: (error as Error).message }));
    } finally {
      setBusy(null);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 rounded-lg" disabled={busy !== null}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          {t("export.button")}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("export.menuLabel")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {EXPORT_TABLES.map((table) => (
          <DropdownMenuItem key={table} onSelect={() => run(table)}>
            {t(`export.tables.${table}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
