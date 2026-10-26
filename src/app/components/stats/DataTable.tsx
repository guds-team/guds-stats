import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "../../lib/format";

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => React.ReactNode;
  numeric?: boolean;
  /** Value to sort by; columns without it are not sortable. Nulls ("not measured") always go last. */
  sort?: (row: Row) => number | string | null | undefined;
  /** Extra classes for the column's cells, e.g. "hidden md:table-cell" for a secondary column on phones. */
  className?: string;
}

type Sort = { key: string; dir: "asc" | "desc" } | null;

/**
 * The table view of a chart: the same rows the CSV export contains, sortable
 * on the client (the rows are already aggregated by the API).
 */
export function DataTable<Row>({
  columns,
  rows,
  caption,
  pageSize,
  rowKey,
}: {
  columns: Column<Row>[];
  rows: Row[];
  caption: string;
  /** Paginate instead of scrolling inside a fixed height. */
  pageSize?: number;
  rowKey?: (row: Row) => string | number;
}) {
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !column?.sort) return rows.map((row, index) => ({ row, index }));
    const value = column.sort;
    const sign = sort.dir === "asc" ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const x = value(a.row);
        const y = value(b.row);
        if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
        if (y === null || y === undefined) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * sign;
      });
  }, [rows, columns, sort]);

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1); // rows can shrink under a live update
  const shown = pageSize ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;

  const cycle = (key: string, numeric?: boolean) =>
    setSort((s) => {
      const first = numeric ? "desc" : "asc";
      if (!s || s.key !== key) return { key, dir: first };
      if (s.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
      return null; // third click: back to the API's order
    });

  return (
    <div className="space-y-3">
      <div className={`overflow-auto rounded-lg border ${pageSize ? "" : "max-h-[340px]"}`}>
        <table className="w-full caption-bottom text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b">
              {columns.map((c) => {
                const active = sort?.key === c.key ? sort.dir : null;
                const SortIcon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : undefined}
                    className={`h-10 bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] px-3 text-xs font-medium whitespace-nowrap text-muted-foreground ${
                      c.numeric ? "text-right" : "text-left"
                    } ${c.className ?? ""}`}
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => cycle(c.key, c.numeric)}
                        className={`inline-flex items-center gap-1 rounded text-xs font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring ${
                          active ? "text-foreground" : ""
                        }`}
                      >
                        {c.header}
                        <SortIcon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map(({ row, index }) => (
              <tr key={rowKey ? rowKey(row) : index} className="transition-colors hover:bg-muted/40">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2.5 whitespace-nowrap ${c.numeric ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label={`${caption}: sahifalar`} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {formatNumber(current * pageSize! + 1)}–{formatNumber(Math.min(sorted.length, (current + 1) * pageSize!))} /{" "}
            {formatNumber(sorted.length)}
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              aria-label="Oldingi sahifa"
              className="grid h-8 w-8 place-items-center rounded-lg border bg-background transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="px-2 tabular-nums">
              {current + 1} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              aria-label="Keyingi sahifa"
              className="grid h-8 w-8 place-items-center rounded-lg border bg-background transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </span>
        </nav>
      )}
    </div>
  );
}
