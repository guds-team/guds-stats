import { DataTable, type Column } from "./DataTable";
import { Panel } from "./Panel";
import { EmptyState } from "./states";
import type { ExportTable } from "../../lib/csv";
import type { ApiParams } from "../../lib/filters";
import { describeChange, formatNumber, formatPercent } from "../../lib/format";
import type { DimensionRow } from "../../lib/types";

interface Row extends DimensionRow {
  key: string;
  label: string;
}

/**
 * New registrations of the period per value. Shares are of all new
 * registrations matching the filters, so the rows always add up to 100%.
 */
export function DistributionPanel({
  title,
  table,
  rows,
  total,
  params,
  color,
}: {
  title: string;
  table: ExportTable;
  rows: Row[];
  total: number;
  params: ApiParams;
  color: string;
}) {
  const visible = rows.filter((r) => (r.registrations.value ?? 0) > 0);
  const columns: Column<Row>[] = [
    { key: "label", header: "Qiymat", cell: (r) => r.label },
    { key: "count", header: "Soni", numeric: true, cell: (r) => formatNumber(r.registrations.value) },
    { key: "share", header: "Ulushi", numeric: true, cell: (r) => formatPercent(r.share_percent) },
    { key: "previous", header: "Oldingi davr", numeric: true, cell: (r) => formatNumber(r.registrations.previous) },
    { key: "change", header: "O'zgarish", numeric: true, cell: (r) => describeChange(r.registrations, "neutral").text },
  ];

  const chart =
    visible.length === 0 ? (
      <EmptyState />
    ) : (
      <ul className="space-y-3" aria-label={title}>
        {visible.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{formatNumber(r.registrations.value)}</span>
                <span className="ml-2 text-muted-foreground">{formatPercent(r.share_percent)}</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
              <div className="h-2 rounded-full" style={{ width: `${r.share_percent ?? 0}%`, background: color }} />
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <Panel
      title={title}
      description={`Davrdagi yangi ro'yxatdan o'tishlar: jami ${formatNumber(total)} (100%)`}
      exportTable={table}
      params={params}
      chart={chart}
      table={<DataTable caption={title} columns={columns} rows={rows} />}
    />
  );
}
