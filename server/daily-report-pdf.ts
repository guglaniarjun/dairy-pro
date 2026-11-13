import PDFDocument from "pdfkit";
import { dailyBrief } from "@shared/daily-brief";

/** Compact, readable columns. Extra pages are used only when needed to preserve all rows. */
export async function compactReportPdf(report: any): Promise<Buffer> {
  const b = dailyBrief(report);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margins: { top: 28, left: 28, right: 28, bottom: 0 },
      size: "A4",
      bufferPages: true,
      info: {
        Title: `Daily Farm Report - ${report.date}`,
        Author: "DairyFlow",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const regular = process.env.REPORT_FONT_PATH || "Helvetica";
    const bold = process.env.REPORT_FONT_PATH || "Helvetica-Bold";
    const clean = (v: any) =>
      String(v ?? "")
        .replaceAll("₹", "INR ")
        .replace(/[–—−]/g, "-")
        .replaceAll("…", "...");
    const num = (n: any) => (n == null ? "--" : Number(n).toFixed(1));
    const money = (n: any) =>
      Number(n || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const width = (doc.page.width - 56 - 18) / 2;
    let column = 0,
      y = 111;
    const x = () => 28 + column * (width + 18);
    const bottom = doc.page.height - 45;
    const fontSize = 8.5;
    const header = () => {
      doc
        .font(bold)
        .fontSize(17)
        .fillColor("#163e34")
        .text(clean(report.farmName || "DairyFlow"), 28, 25, {
          width: doc.page.width - 56,
        });
      doc
        .font(bold)
        .fontSize(11)
        .fillColor("#172b26")
        .text(`DAILY FARM BRIEF  |  ${report.date}`, 28, 49);
      doc
        .font(regular)
        .fontSize(7)
        .fillColor("#52615b")
        .text(
          `Farm time: ${report.timezone}  |  ${report.revision ? `Revision ${report.revision}` : "Live report"}  |  Generated ${String(
            report.generatedAt || "",
          )
            .slice(0, 16)
            .replace("T", " ")} UTC`,
          28,
          65,
          { width: doc.page.width - 56 },
        );
      doc.roundedRect(28, 80, doc.page.width - 56, 22, 4).fill("#edf4f0");
      doc
        .font(bold)
        .fontSize(9)
        .fillColor("#163e34")
        .text(
          `Produced ${num(report.milk?.produced)} L   |   Sold ${num(report.milk?.sold)} L   |   Sales INR ${money(b.totals.sales)}`,
          36,
          87,
          { width: doc.page.width - 72 },
        );
    };
    const advance = () => {
      if (column === 0) column = 1;
      else {
        doc.addPage();
        column = 0;
        header();
      }
      y = 111;
    };
    header();
    const title = (text: string, continued = false) => {
      if (y + 40 > bottom) advance();
      doc.rect(x(), y, width, 19).fill("#e7eeea");
      doc
        .font(bold)
        .fontSize(9)
        .fillColor("#163e34")
        .text(clean(text) + (continued ? " (cont.)" : ""), x() + 5, y + 5, {
          width: width - 10,
          lineBreak: false,
        });
      y += 23;
    };
    const wrap = (value: any, available: number) => {
      doc.font(regular).fontSize(fontSize);
      const lines: string[] = [];
      let line = "";
      for (const word of clean(value).split(/\s+/)) {
        if (line && doc.widthOfString(`${line} ${word}`) > available) {
          lines.push(line);
          line = "";
        }
        // Split long unbroken identifiers instead of letting them cross columns.
        let piece = "";
        for (const char of word) {
          if (doc.widthOfString(piece + char) > available) {
            if (line) {
              lines.push(line);
              line = "";
            }
            lines.push(piece);
            piece = "";
          }
          piece += char;
        }
        line = line ? `${line} ${piece}` : piece;
      }
      lines.push(line);
      return lines;
    };
    const table = (
      name: string,
      headings: string[],
      fractions: number[],
      records: any[][],
      empty = "None recorded.",
    ) => {
      const widths = fractions.map((f) => f * width);
      const tableHeader = () => {
        let left = x();
        doc.font(bold).fontSize(7.5).fillColor("#52615b");
        headings.forEach((h, i) => {
          doc.text(h, left + 3, y, { width: widths[i] - 6, lineBreak: false });
          left += widths[i];
        });
        y += 15;
      };
      const rows = records.length
        ? records
        : [[empty, ...headings.slice(1).map(() => "")]];
      const sectionHeight =
        38 +
        rows.reduce(
          (n, row) =>
            n +
            Math.max(
              ...row.map((value, i) => wrap(value, widths[i] - 6).length),
            ) *
              11 +
            5,
          0,
        );
      // Keep short sections together; let long tables fill the available column.
      if (sectionHeight <= 150 && y + sectionHeight > bottom)
        advance();
      title(name);
      tableHeader();
      for (const row of rows) {
        const cells = row.map((v, i) => wrap(v, widths[i] - 6));
        let offset = 0;
        const totalLines = Math.max(...cells.map((c) => c.length));
        while (offset < totalLines) {
          let available = Math.floor((bottom - y - 6) / 11);
          const remaining = totalLines - offset;
          if (available < Math.min(remaining, 5)) {
            advance();
            title(name, true);
            tableHeader();
            available = Math.floor((bottom - y - 6) / 11);
          }
          const lines = Math.min(remaining, available);
          let left = x();
          doc.font(regular).fontSize(fontSize).fillColor("#182b24");
          cells.forEach((cell, i) => {
            cell.slice(offset, offset + lines).forEach((line, n) =>
              doc.text(line, left + 3, y + 2 + n * 11, {
                width: widths[i] - 6,
                lineBreak: false,
              }),
            );
            left += widths[i];
          });
          y += lines * 11 + 5;
          doc
            .moveTo(x(), y)
            .lineTo(x() + width, y)
            .lineWidth(0.3)
            .strokeColor("#d9e1dc")
            .stroke();
          offset += lines;
        }
      }
      y += 10;
    };
    table(
      "Milk by animal (litres)",
      [
        "Tag / name",
        ...b.sessions.map((s) =>
          s === "morning" ? "AM" : s === "evening" ? "PM" : s.slice(0, 5),
        ),
        "Total",
      ],
      [
        0.42,
        ...b.sessions.map(() => 0.58 / (b.sessions.length + 1)),
        0.58 / (b.sessions.length + 1),
      ],
      [
        ...b.milkRows.map((r) => [
          `${r.tag}${r.name ? ` ${r.name}` : ""}${r.discarded ? " *" : ""}`,
          ...b.sessions.map((s) => num(r.sessions[s])),
          num(r.total),
        ]),
        [
          "TOTAL",
          ...b.sessions.map((s) =>
            num(b.milkRows.reduce((n, r) => n + Number(r.sessions[s] || 0), 0)),
          ),
          num(report.milk?.produced),
        ],
      ],
    );
    table(
      "Milk balance",
      ["Allocation / check", "Litres"],
      [0.76, 0.24],
      [
        ["Opening stock", num(report.milk?.opening || 0)],
        ["Produced (including discarded)", num(report.milk?.produced)],
        ["Discarded at milking (*)", num(report.milk?.discardedAtMilking || 0)],
        ["Sold", num(report.milk?.sold)],
        ...b.allocations
          .filter((a) => a.kind !== "opening stock")
          .map((a) => [a.kind, num(a.quantity)]),
        ["Unallocated / discrepancy", num(report.milk?.unallocated)],
        ["-- means not recorded, not zero. * includes discarded milk.", ""],
      ],
    );
    table(
      "Sales by customer",
      ["Customer / product", "Qty", "INR"],
      [0.6, 0.17, 0.23],
      b.saleRows.map((s) => [
        `${s.customer}: ${s.product} @ ${money(s.rate || s.pricePerLiter)}/${s.unit || "L"}`,
        `${num(s.quantity)} ${s.unit || "L"}`,
        money(s.totalAmount),
      ]),
    );
    table(
      "Customer accounts (INR)",
      ["Customer", "Sale / paid", "Debit / credit"],
      [0.39, 0.3, 0.31],
      b.customers.map((c: any) => [
        c.name,
        `${money(c.sales)} / ${money(c.received)}`,
        `${money(c.debit)} Dr / ${money(c.credit)} Cr`,
      ]),
    );
    table(
      "Health and treatments",
      ["Animal / issue / administered treatment", "Date"],
      [0.8, 0.2],
      b.health.map((h) => [h.text, h.date || report.date]),
      "No health issues or treatments recorded.",
    );
    table(
      "Work and upcoming activities",
      ["Animal / action / instructions", "When / owner"],
      [0.73, 0.27],
      b.actions.map((a) => [
        `${a.tag}: ${a.title}${a.instructions ? ` - ${a.instructions}` : ""}`,
        `${a.countdown}${a.dueDate ? ` (${a.dueDate})` : ""}; ${a.assignedTo || "Unassigned"}`,
      ]),
      "No outstanding or completed actions in the reporting window.",
    );
    table(
      "Other farm activity",
      ["Activity", "Date"],
      [0.8, 0.2],
      b.activity.map((a) => [a.text, a.date || report.date]),
    );
    table(
      "Finance and stock exceptions",
      ["Entry", "Amount / quantity"],
      [0.7, 0.3],
      [
        ["Payments received", `INR ${money(b.totals.received)}`],
        ["Income recorded", `INR ${money(b.totals.income)}`],
        ["Expenses recorded", `INR ${money(b.totals.expenses)}`],
        ...(report.finance?.expenses || []).map((e: any) => [
          e.description || e.vendorName || "Expense",
          `INR ${money(e.amount)}`,
        ]),
        ...(report.stock || [])
          .filter((s: any) => s.shortage || s.lowStock || s.expired?.length)
          .map((s: any) => [
            `${s.name}${s.expired?.length ? `; ${s.expired.length} expired lots` : ""}`,
            `${num(s.available)} ${s.unit}; shortage ${num(s.shortage)}`,
          ]),
      ],
    );
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc
        .font(regular)
        .fontSize(6.8)
        .fillColor("#52615b")
        .text(
          "Entries include late records. Animal/work status is current at generation; saved revisions preserve that snapshot.",
          28,
          doc.page.height - 32,
          { width: doc.page.width - 56, lineBreak: false },
        );
      doc.text(
        `DairyFlow | ${report.date} | Page ${i + 1} of ${range.count} | Full records and audit trail: Excel / daily report`,
        28,
        doc.page.height - 21,
        { width: doc.page.width - 56, lineBreak: false },
      );
    }
    doc.end();
  });
}
