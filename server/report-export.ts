import ExcelJS from "exceljs";
import { compactReportPdf } from "./daily-report-pdf";
const readable = (value: any): string =>
  value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
export function reportSections(report: any): [string, any[]][] {
  return [
    [
      "Milk summary",
      [
        {
          produced: report.milk.produced,
          opening: report.milk.opening || 0,
          discardedAtMilking: report.milk.discardedAtMilking || 0,
          saleable: report.milk.saleable,
          sold: report.milk.sold,
          used: report.milk.used,
          unallocated: report.milk.unallocated,
        },
      ],
    ],
    ["Milk entries", report.milk.entries],
    ["Missing milk", report.milk.missing],
    ["Milk sales", report.milk.sales],
    ["Milk uses", report.milk.dispositions],
    ["Dairy sales", report.dairySales?.entries || []],
    ["Sales receipts", report.dairySales?.payments || []],
    ["Customer balances", report.dairySales?.customers || []],
    ["Dairy product stock", report.dairySales?.products || []],
    ["Dairy stock movements", report.dairySales?.stockMovements || []],
    ["Animal roster", report.animals],
    ["Events", report.events],
    ["Other entries", report.entries],
    ["Worklist", report.tasks],
    ["Upcoming reminders", report.reminders || []],
    ["Active health", report.activeHealth || []],
    [
      "Batch work",
      report.batches.flatMap((b: any) =>
        b.animals.map((a: any) => ({ batch: b.title, ...a })),
      ),
    ],
    ["Stock forecast", report.stock],
    ["Stock movements", report.stockMovements],
    ["Income", report.finance.income],
    ["Expenses", report.finance.expenses],
    ["Allocated costs", report.finance.costs],
    ["Audit trail", report.audit],
  ];
}
export async function reportWorkbook(report: any) {
  const book = new ExcelJS.Workbook();
  book.creator = "DairyFlow";
  const meta = book.addWorksheet("Report details");
  meta.addRows([
    ["Date", report.date],
    ["Farm timezone", report.timezone],
    ["Generated at", report.generatedAt],
    ["Revision", report.revision || "Live preview"],
    [
      "Basis",
      "Entries for the date and late entries/corrections recorded that day. Animal and work status as at generation.",
    ],
  ]);
  meta.getColumn(1).width = 24;
  meta.getColumn(2).width = 90;
  for (const [title, data] of reportSections(report)) {
    const sheet = book.addWorksheet(title.slice(0, 31));
    const keys = [...new Set(data.flatMap(Object.keys))];
    sheet.columns = keys.map((k) => ({
      header: k,
      key: k,
      width: Math.min(55, Math.max(18, k.length + 3)),
    }));
    data.forEach((row) =>
      sheet.addRow(Object.fromEntries(keys.map((k) => [k, readable(row[k])]))),
    );
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    if (keys.length)
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, data.length + 1), column: keys.length },
      };
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
export const reportPdf = compactReportPdf;
