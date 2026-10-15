import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => React.ReactNode;
  numeric?: boolean;
}

/** The table view of a chart: the same rows the CSV export contains. */
export function DataTable<Row>({ columns, rows, caption }: { columns: Column<Row>[]; rows: Row[]; caption: string }) {
  return (
    <div className="max-h-[320px] overflow-auto rounded-md border">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} scope="col" className={c.numeric ? "text-right" : undefined}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key} className={c.numeric ? "text-right tabular-nums" : undefined}>
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
