import PDFDocument from "pdfkit";
import { briefingView, type BriefingAction, type BriefingMedicine } from "@shared/daily-briefing";
import { dailyBrief } from "@shared/daily-brief";
import { finishedTask } from "@shared/care";

/** Two main print pages, with labelled continuations when real records need more space. */
export async function printableBriefingPdf(report: any): Promise<Buffer> {
  const view = briefingView(report);
  const brief = dailyBrief(report);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 28, bottom: 0, left: 28, right: 28 }, autoFirstPage: false, bufferPages: true,
      info: { Title: `${view.period === "morning" ? "Morning" : "Evening"} farm report - ${view.briefingDate}`, Author: "DairyFlow" } });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const regular = process.env.REPORT_FONT_PATH || "Helvetica";
    const bold = process.env.REPORT_BOLD_FONT_PATH || process.env.REPORT_FONT_PATH || "Helvetica-Bold";
    const ink = "#202923", muted = "#58625c", fill = "#edf1ed", border = "#c5cdc6";
    const width = 595.28 - 56, bottom = 780;
    const pageSections: string[] = [];
    let y = 0, section = "Farm overview";
    const clean = (value: unknown) => String(value ?? "").replaceAll("₹", "Rs ").replace(/[–—−]/g, "-").replaceAll("…", "...");
    const number = (n: any) => n == null || n === "" ? "Not recorded" : Number(n).toFixed(1);
    const money = (n: any) => Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const words = (v: any) => String(v || "").replaceAll("_", " ");
    const date = (v: string | null | undefined) => {
      if (!v) return "Not recorded";
      const parsed = new Date(`${String(v).slice(0, 10)}T12:00:00Z`);
      return Number.isFinite(parsed.valueOf()) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed) : clean(v);
    };
    const timestamp = (v: any) => {
      if (!v) return "Not recorded";
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return date(v) + " (time not recorded)";
      if (/^\d{2}:\d{2}$/.test(String(v))) {
        const [h, m] = String(v).split(":").map(Number);
        return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
      }
      const parsed = new Date(v);
      return Number.isFinite(parsed.valueOf()) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: view.timezone }).format(parsed) : clean(v);
    };
    const write = (text: any, x: number, top: number, w: number, size = 10.5, strong = false, color = ink) => {
      doc.font(strong ? bold : regular).fontSize(size).fillColor(color).text(clean(text), x, top, { width: w, lineBreak: false });
    };
    const wrapped = (text: any, w: number, size: number, strong = false): string[] => {
      doc.font(strong ? bold : regular).fontSize(size);
      const result: string[] = [];
      for (const paragraph of clean(text).split("\n")) {
        let line = "";
        for (let word of paragraph.split(/\s+/).filter(Boolean)) {
          if (line && doc.widthOfString(`${line} ${word}`) > w) { result.push(line); line = ""; }
          while (doc.widthOfString(word) > w) {
            if (line) { result.push(line); line = ""; }
            let n = 1;
            while (n < word.length && doc.widthOfString(word.slice(0, n + 1)) <= w) n++;
            result.push(word.slice(0, n)); word = word.slice(n);
          }
          line = line ? `${line} ${word}` : word;
        }
        result.push(line);
      }
      return result.length ? result : [""];
    };
    const rule = (top: number) => doc.moveTo(28, top).lineTo(28 + width, top).lineWidth(.4).strokeColor(border).stroke();
    const page = (label: string, continuation = false) => {
      section = label;
      doc.addPage(); pageSections.push(label);
      write(report.farmName || "DairyFlow", 28, 24, width, 15, true);
      write(`${view.period === "morning" ? "Morning" : "Evening"} report - ${date(view.briefingDate)}`, 28, 49, width, 19, true);
      write(`Figures for ${date(view.coveredDate)}. Tasks for ${date(view.actionDate)}.`, 28, 77, width, 10.5, false, muted);
      write(`Prepared ${timestamp(view.generatedAt)} (${view.timezone}). ${report.revision ? `Saved revision ${report.revision}` : "Live preview"}${continuation ? ` - ${label} continued` : ""}`, 28, 94, width, 9, false, muted);
      rule(105); y = 116;
    };
    const ensure = (height: number, label = section) => { if (y + height > bottom) page(label, true); };
    const paragraph = (text: any, strong = false, size = 10.5) => {
      const lines = wrapped(text, width, size, strong);
      for (const line of lines) { ensure(size + 6); write(line, 28, y, width, size, strong); y += size + 3; }
      y += 5;
    };
    const heading = (title: string) => { ensure(42, title); write(title, 28, y, width, 12, true); y += 23; };
    const table = (title: string, headers: string[], fractions: number[], records: any[][], empty: string) => {
      const widths = fractions.map(f => f * width), size = 10.5, leading = 12;
      if (!records.length) { heading(title); paragraph(empty); return; }
      const headerLines = headers.map((v, i) => wrapped(v, widths[i] - 10, 9.5, true));
      const headerH = Math.max(...headerLines.map(l => l.length)) * 11 + 10;
      const start = (continued = false) => {
        ensure(55, title); write(title + (continued ? " (continued)" : ""), 28, y, width, 12, true); y += 22;
        doc.rect(28, y, width, headerH).fill(fill);
        let x = 28;
        headerLines.forEach((lines, i) => { lines.forEach((line, n) => write(line, x + 5, y + 5 + n * 11, widths[i] - 10, 9.5, true)); x += widths[i]; });
        y += headerH;
      };
      start();
      for (const row of records) {
        const emphasis = row.map(v => /\bURGENT\b|\bCHECK:|\bDo not sell milk\b/.test(clean(v)));
        const cells = row.map((v, i) => wrapped(v, widths[i] - 10, size, emphasis[i]));
        const length = Math.max(...cells.map(c => c.length));
        let offset = 0;
        while (offset < length) {
          let capacity = Math.floor((bottom - y - 6) / leading);
          if (capacity < Math.min(3, length - offset)) { page(title, true); start(true); capacity = Math.floor((bottom - y - 6) / leading); }
          const lines = Math.min(length - offset, capacity);
          let x = 28;
          cells.forEach((cell, i) => {
            const fragment = offset > 0 && i === 0 && cell.length <= offset ? wrapped(`${cell[0]} (continued)`, widths[i] - 10, size, emphasis[i]).slice(0, lines) : cell.slice(offset, offset + lines);
            fragment.forEach((line, n) => write(line, x + 5, y + 4 + n * leading, widths[i] - 10, size, emphasis[i])); x += widths[i];
          });
          y += lines * leading + 6; rule(y); offset += lines;
        }
      }
      y += 15;
    };
    const due = (a: { dueDate?: string | null; dueTime?: string | null }) => `${a.dueDate ? date(a.dueDate) : "Date needed"}${a.dueTime ? `, ${timestamp(a.dueTime)}` : ""}`;
    const actionStatus = (a: BriefingAction) => `${a.urgent ? "URGENT - " : ""}${a.overdue ? "Overdue - " : ""}${words(a.status)}`;

    page("Farm overview");
    const cards = [["Milk produced", `${number(view.totals.produced)} L`], ["Milk sold", `${number(view.totals.sold)} L`], ["Dairy sales", `Rs ${money(view.totals.sales)}`], ["Money received", `Rs ${money(view.totals.received)}`]];
    const cardW = (width - 24) / 4;
    cards.forEach(([title, value], i) => {
      const x = 28 + i * (cardW + 8);
      doc.rect(x, y, cardW, 53).lineWidth(.5).strokeColor(border).stroke();
      write(title, x + 7, y + 8, cardW - 14, 9.5, true); write(value, x + 7, y + 26, cardW - 14, 14, true);
    }); y += 62;
    paragraph(`${view.totals.recordedEntries} of ${view.totals.expectedEntries} expected milking entries recorded.${view.totals.missingEntries ? ` ${view.totals.missingEntries} missing: production is a subtotal.` : " All expected milk entries are present."}`, view.totals.missingEntries > 0, 10);
    paragraph(`Herd now: ${view.herd.total} animals; ${view.herd.inMilk} being milked; ${view.herd.dry} dry; ${view.herd.heifers} young females; ${view.herd.calves} calves. ${view.herd.pregnant} pregnant (included in these groups). Open health cases: ${view.totals.activeHealth}.`, false, 10);
    const urgentCustomers = view.customerUpcoming.filter(a => a.priority === "urgent" && !finishedTask(a.status));
    const allUrgent = [...view.urgentActions, ...urgentCustomers.map(a => ({ title: `${a.customerName}: ${a.title}`, tag: "Customer", assignedTo: a.assignedTo }))];
    paragraph(allUrgent.length ? `URGENT: ${allUrgent.length} task(s). ${allUrgent[0].tag}: ${allUrgent[0].title}. Who: ${allUrgent[0].assignedTo}. Full list on the care and customer pages.` : "No tasks explicitly marked urgent. Due, overdue and missing-record work is listed on the care and customer pages.", true, 10);
    if (view.restrictions.length) paragraph(`DO NOT SELL MILK: ${view.restrictions.map(r => r.tag).slice(0, 6).join(", ")}${view.restrictions.length > 6 ? ` and ${view.restrictions.length - 6} more` : ""}. All restrictions are listed with medicines and care below.`, true, 10);
    const sessions = view.sessions;
    const sessionLabel = (v: string) => v === "morning" ? "Morning" : v === "evening" ? "Evening" : words(v);
    const milkFractions = [0.23, ...sessions.map(() => .42 / (sessions.length + 1)), .42 / (sessions.length + 1), .13, .22];
    const milkRecords = view.milkRows.map(row => {
      const notes: string[] = [];
      for (const session of sessions) {
        const cmp = row.comparisons[session];
        if (cmp?.isLow) notes.push(`CHECK: ${sessionLabel(session)} ${Math.round(Math.abs(cmp.deltaPercent || 0))}% less`);
      }
      if (row.missingSessions.length) notes.push(`Missing ${row.missingSessions.map(sessionLabel).join(", ")}`);
      if (row.withheld) notes.push("Do not sell milk");
      if (!row.missingSessions.includes("evening") && row.pmComparison.reason === "insufficient_history") notes.push("Not enough earlier records");
      return [`${row.tag}${row.name ? `\n${row.name}` : ""}`, ...sessions.map(s => row.sessions[s] == null ? "Missing" : number(row.sessions[s])), row.total == null ? "Missing" : number(row.total) + (row.isSubtotal ? "*" : ""), row.pmComparison.usual == null ? "Unknown" : number(row.pmComparison.usual), notes.join("; ")];
    });
    milkRecords.push(["TOTAL", ...sessions.map(s => number(view.milkRows.reduce((sum, row) => sum + Number(row.sessions[s] || 0), 0))), number(view.totals.produced) + (view.totals.missingEntries ? "*" : ""), "", view.totals.missingEntries ? "*Recorded subtotal" : "All expected entries present"]);
    table(`Milk by animal - ${date(view.coveredDate)} (litres)`, ["Animal", ...sessions.map(sessionLabel), "Total", "Usual evening", "Note"], milkFractions, milkRecords, "No milk measurements or expected milking animals recorded.");
    paragraph(`Usual = the animal's earlier yield for the same session, ${date(view.rules.historyFrom)} to ${date(view.rules.historyTo)}; at least ${view.rules.minRecords} earlier records. Flag only when BOTH ${view.rules.dropPercent}% and ${view.rules.minDropLitres} L reductions are reached.`, false, 9.5);
    paragraph("Missing is not zero. *The total includes recorded milk only. Measured discarded milk stays in production.", false, 9.5);
    paragraph(`Milk check (L): opening ${number(view.totals.opening)} + produced ${number(view.totals.produced)} - discarded at milking ${number(report.milk?.discardedAtMilking)} - sold ${number(view.totals.sold)} - recorded uses / closing milk ${number(report.milk?.used)} = ${number(view.totals.unallocated)} not explained.`, view.totals.unallocated !== 0, 9.5);
    if (view.totals.previousClosing != null && view.totals.previousClosing !== view.totals.opening) paragraph(`Check carried milk: previous closing ${number(view.totals.previousClosing)} L; opening ${number(view.totals.opening)} L.`, true, 10);

    page("Care, tasks and customers");
    const pending = view.actions.filter(a => !finishedTask(a.status));
    table(`What needs doing - ${date(view.actionDate)}`, ["Animal / task", "Who", "By when", "Status"], [.52, .15, .18, .15], pending.map(a => [`${a.tag}: ${a.title}${a.instructions ? `\n${a.instructions}` : ""}`, a.assignedTo || "Not assigned", due(a), actionStatus(a)]), "No open farm tasks recorded. This does not confirm that all work was entered.");
    const medicineRows = (rows: BriefingMedicine[]) => rows.map(m => {
      const amount = m.dosage || (m.supplies.length ? m.supplies.map(s => `${s.name}: ${s.quantity} ${s.unit || "unit not recorded"}`).join("; ") : "Amount not recorded");
      return [`${m.tag}: ${m.medicineName || "Medicine name not recorded"}\n${amount}${m.route ? `; ${m.route === "oral" ? "by mouth" : words(m.route)}` : "; route not recorded"}${m.notes ? `\n${m.notes}` : ""}`, `${date(m.date)}\n${m.administeredAt ? timestamp(m.administeredAt) : "Time not recorded"}\n${m.administeredBy || "Person not recorded"}`, m.withdrawalUntil ? `Do not sell milk until ${timestamp(m.withdrawalUntil)}. Follow the recorded release review.` : "Not recorded. Check the care record."];
    });
    table(`Medicines given - ${date(view.coveredDate)}`, ["Animal, medicine and amount", "Given when / by whom", "Milk-sale restriction"], [.46, .25, .29], medicineRows(view.medicines), "No medicine administrations recorded for this date. This is not a confirmed 'none given'.");
    if (view.currentMedicines.length) table(`Given on ${date(view.actionDate)} after the covered day`, ["Animal, medicine and amount", "Given when / by whom", "Milk-sale restriction"], [.46, .25, .29], medicineRows(view.currentMedicines), "No later administrations recorded.");
    if (view.restrictions.length) paragraph(`Current milk-sale restrictions: ${view.restrictions.map(r => `${r.tag} until ${timestamp(r.until)}`).join("; ")}. Follow the recorded release review before sale.`, true, 10);
    if (view.period === "morning" && view.currentMorning.expectedAnimals) paragraph(`Latest morning update for ${date(view.actionDate)}: ${number(view.currentMorning.total)} L from ${view.currentMorning.recordedAnimals} of ${view.currentMorning.expectedAnimals} expected animals. ${view.currentMorning.missing.length ? `Still awaiting: ${view.currentMorning.missing.map((a: any) => a.tag || a.tagNumber || a.id).join(", ")}.` : "All expected morning entries present."} This update is separate from yesterday's totals.`, false, 10);
    table(`Customer activities - due and next 30 days from ${date(view.actionDate)}`, ["Customer", "What is coming up", "Who / by when", "Status"], [.23, .4, .24, .13], view.customerUpcoming.map(a => [a.customerName, `${a.title}${a.instructions ? `\n${a.instructions}` : ""}${a.source !== "manual" ? `\nFrom recorded ${words(a.source)}` : ""}`, `${a.assignedTo || "Not assigned"}\n${due(a)}`, `${a.priority === "urgent" ? "URGENT\n" : ""}${words(a.status)}`]), "No upcoming customer activities or unpaid bill due dates recorded.");
    table(`Customer accounts - ${date(view.coveredDate)}`, ["Customer", "Billed Rs", "Received Rs", "Still owes Rs", "Advance Rs"], [.32, .17, .17, .17, .17], brief.customers.length ? [...brief.customers.map((c: { name: string; sales: number; received: number; debit: number; credit: number }) => [c.name, money(c.sales), money(c.received), money(c.debit), money(c.credit)]), ["TOTAL", money(view.totals.sales), money(view.totals.received), money(view.totals.outstanding), money(view.totals.advances)]] : [], "No customer account entries recorded.");
    paragraph("Received means money collected on the covered date. Still owes includes older unpaid bills. Advance is customer money held for future bills; it is separate from money owed. Unlinked milk-buyer sales, if any, are included in sales totals but do not create a customer account.", false, 9.5);
    heading("Expenses and feed");
    paragraph(`Expenses recorded: Rs ${money(view.totals.expenses)}. ${!(report.finance?.expenses || []).length ? "No expense entries recorded; this is not proof of no costs." : "This is recorded spending, not profit."}`, false, 10.5);
    for (const expense of report.finance?.expenses || []) paragraph(`${expense.description || expense.vendorName || "Expense"}: Rs ${money(expense.amount)}`, false, 10);
    const warnings = (report.stock || []).filter((s: any) => s.shortage || s.lowStock || s.expired?.length || s.expiring?.length || s.untracked);
    if (!warnings.length) paragraph((report.stock || []).length ? "No stock warnings recorded." : "Feed and medicine stock not recorded in this report.", false, 10);
    for (const stock of warnings) paragraph(`${stock.name}: ${number(stock.available)} ${stock.unit} usable; ${number(stock.shortage)} short; ${stock.expired?.length || 0} expired lots; ${stock.expiring?.length || 0} lots nearing expiry.${stock.lowStock ? " Below the minimum stock level." : ""}${stock.untracked ? " Stock records need checking." : ""} Assign follow-up.`, !!stock.shortage, 10);

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      rule(803);
      write(`${view.period === "morning" ? "Morning" : "Evening"} ${i + 1}/${pages.count} - ${pageSections[i]}`, 28, 810, width, 8.3, true, muted);
      write(`DairyFlow | ${view.briefingDate} | ${report.revision ? `Saved revision ${report.revision}` : "Live preview"}${pages.count > 2 ? " | Continuation pages keep all records readable" : ""}`, 28, 824, width, 7.7, false, muted);
    }
    doc.end();
  });
}
