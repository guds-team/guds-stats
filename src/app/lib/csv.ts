// CSV export: the backend renders it (GET /api/stats/overview/export/) from the
// same overview result as the dashboard, for the complete filtered table —
// UTF-8 with BOM, ISO dates, formula-injection safe.

import { apiGet } from "./api";
import type { ApiParams } from "./filters";

export const EXPORT_PATH = "/api/stats/overview/export/";

export type ExportTable = "registrations" | "activity" | "objects" | "authentication" | "country" | "registered_via";

export function exportFilename(table: ExportTable, params: ApiParams): string {
  return `guds-stats-${table}-${params.date_from}_${params.date_to}.csv`;
}

export async function downloadCsv(table: ExportTable, params: ApiParams): Promise<void> {
  const response = await apiGet(EXPORT_PATH, { ...params, table });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename(table, params);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked after the click has been handled: revoking synchronously can cancel the download (Firefox).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
