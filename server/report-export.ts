import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
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
    ["Animal roster", report.animals],
    ["Events", report.events],
    ["Other entries", report.entries],
    ["Worklist", report.tasks],
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
export async function reportPdf(report: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    if (process.env.REPORT_FONT_PATH) doc.font(process.env.REPORT_FONT_PATH);
    doc.fontSize(20).text(`Daily Farm Report - ${report.date}`);
    doc
      .fontSize(9)
      .text(
        `Timezone: ${report.timezone} | Generated: ${report.generatedAt} | Revision: ${report.revision || "preview"}`,
      );
    doc.text(
      "Activity for the date, including late entries and corrections. Animal/work status is as recorded at generation.",
    );
    for (const [title, items] of reportSections(report)) {
      doc.moveDown().fontSize(14).text(`${title} (${items.length})`);
      doc.fontSize(8);
      if (!items.length) doc.text("No records.");
      for (const item of items) {
        doc.moveDown(0.6);
        for (const [key, value] of Object.entries(item)) {
          if (value != null && value !== "")
            doc.text(`${key}: ${readable(value)}`, { lineGap: 2 });
        }
      }
    }
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .text(
          `DairyFlow | ${report.date} | Page ${i + 1} of ${range.count}`,
          40,
          doc.page.height - 30,
          { lineBreak: false },
        );
    }
    doc.end();
  });
}
