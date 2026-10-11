/**
 * Escape CSV compartido (panel + exportes de API).
 * Anti CSV-inyección: celdas que empiezan con = + - @ (y TAB/CR, que algunos
 * parsers tratan como fórmula) reciben prefijo ' (Excel/Sheets las tratarían
 * como fórmula). Siempre entrecomillado y comillas internas duplicadas.
 */
export function csvCell(value: string | number): string {
  const s = String(value);
  const guarded = /^[\t\r=+@-]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Header + filas → documento CSV (LF, sin BOM). */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}

/** Response de descarga CSV con Content-Disposition de adjunto. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
