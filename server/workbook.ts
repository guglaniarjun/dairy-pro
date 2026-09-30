import ExcelJS from "exceljs";
import { Readable } from "node:stream";
export async function tableWorkbook(data: any[][], name: string) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(name.slice(0, 31));
  sheet.addRows(data);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((c) => (c.width = 24));
  return Buffer.from(await book.xlsx.writeBuffer());
}
export async function readWorkbook(
  buffer: Buffer,
  filename: string,
): Promise<Record<string, string>[]> {
  const book = new ExcelJS.Workbook();
  if (filename.toLowerCase().endsWith(".csv"))
    await book.csv.read(Readable.from(buffer));
  else if (filename.toLowerCase().endsWith(".xlsx"))
    await book.xlsx.load(buffer as any);
  else throw new Error("Use CSV or XLSX files");
  const sheet = book.worksheets[0];
  if (!sheet) return [];
  if (sheet.rowCount > 10001)
    throw new Error("Import is limited to 10,000 rows");
  const headers: string[] = [];
  sheet.getRow(1).eachCell((c, n) => {
    headers[n] = c.text.trim();
  });
  const out: Record<string, string>[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const item: Record<string, string> = {};
    headers.forEach((h, i) => {
      const cell = row.getCell(i);
      item[h] =
        cell.value instanceof Date
          ? cell.value.toISOString().slice(0, 10)
          : cell.text;
    });
    out.push(item);
  });
  return out;
}
