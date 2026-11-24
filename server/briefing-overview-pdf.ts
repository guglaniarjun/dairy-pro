import PDFDocument from "pdfkit";
import { briefingView, type BriefingAction, type BriefingMedicine } from "@shared/daily-briefing";
import { dailyBrief } from "@shared/daily-brief";
import { finishedTask } from "@shared/care";

/** The short, printable briefing. Transaction-level records remain in the separate full print. */
export async function compactBriefingPdf(report: any): Promise<Buffer> {
  const v = briefingView(report), brief = dailyBrief(report);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 24, bottom: 0, left: 28, right: 28 }, autoFirstPage: false, bufferPages: true,
      info: { Title: `${v.period === "morning" ? "Morning" : "Evening"} farm briefing - ${v.briefingDate}`, Author: "DairyFlow" } });
    const chunks: Buffer[] = [];
    doc.on("data", c => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    const regular = process.env.REPORT_FONT_PATH || "Helvetica", bold = process.env.REPORT_BOLD_FONT_PATH || process.env.REPORT_FONT_PATH || "Helvetica-Bold";
    const ink = "#20382f", muted = "#526159", fill = "#edf1ee", border = "#c8d1ca";
    const x0 = 28, width = 539.28, bottom = 786;
    const pages: string[] = [];
    const clean = (s: any) => String(s ?? "").replaceAll("₹", "Rs ").replace(/[–—−]/g, "-").replaceAll("…", "...");
    const num = (n: any) => n == null || n === "" ? "Missing" : Number(n).toFixed(1);
    const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const date = (d: any, year = false) => {
      if (!d) return "Date not recorded";
      const p = new Date(`${String(d).slice(0, 10)}T12:00:00Z`);
      return Number.isFinite(p.valueOf()) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" as const } : {}), timeZone: "UTC" }).format(p) : clean(d);
    };
    const stamp = (d: any) => {
      if (!d) return "time not recorded";
      if (/^\d{2}:\d{2}$/.test(String(d))) return String(d);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return date(d) + " (time not recorded)";
      const p = new Date(d);
      return Number.isFinite(p.valueOf()) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: v.timezone }).format(p) : clean(d);
    };
    function write(s: any, x: number, y: number, w: number, size = 10, strong = false, color = ink, align: "left" | "right" = "left") {
      doc.font(strong ? bold : regular).fontSize(size).fillColor(color).text(clean(s), x, y, { width: w, lineBreak: false, align });
    }
    function wrap(s: any, w: number, size = 10, strong = false) {
      doc.font(strong ? bold : regular).fontSize(size);
      const result: string[] = [];
      for (const p of clean(s).split("\n")) {
        let line = "";
        for (let word of p.split(/\s+/).filter(Boolean)) {
          if (line && doc.widthOfString(`${line} ${word}`) > w) { result.push(line); line = ""; }
          while (doc.widthOfString(word) > w) {
            if (line) { result.push(line); line = ""; }
            let n = 1; while (n < word.length && doc.widthOfString(word.slice(0, n + 1)) <= w) n++;
            result.push(word.slice(0, n)); word = word.slice(n);
          }
          line = line ? `${line} ${word}` : word;
        }
        if (line || !p) result.push(line);
      }
      return result.length ? result : [""];
    }
    const rule = (x: number, y: number, w: number) => doc.moveTo(x, y).lineTo(x + w, y).lineWidth(.4).strokeColor(border).stroke();
    function page(label: string) {
      doc.addPage(); pages.push(label);
      write(report.farmName || "DairyFlow", x0, 22, width, 14, true);
      write(`${v.period === "morning" ? "Morning" : "Evening"} briefing - ${date(v.briefingDate, true)}`, x0, 43, width, 20, true);
      write(`Farm figures: ${date(v.coveredDate, true)}  |  Work: ${date(v.actionDate)}`, x0, 70, width, 10, false, muted);
      write(`Prepared ${stamp(v.generatedAt)} (${v.timezone})  |  ${report.revision ? `Saved revision ${report.revision}` : "Current preview"}`, x0, 86, width, 9, false, muted);
      rule(x0, 103, width);
      return { x: x0, y: 114, w: width, label };
    }
    type Cursor = ReturnType<typeof page>;
    function paragraph(c: Cursor, text: any, size = 9.5, strong = false, gap = 4) {
      const lines = wrap(text, c.w, size, strong), leading = size + 2;
      for (const line of lines) {
        if (c.y + leading > bottom) { const next = page(c.label + " - continued"); Object.assign(c, next); }
        write(line, c.x, c.y, c.w, size, strong); c.y += leading;
      }
      c.y += gap;
    }
    function heading(c: Cursor, title: string) {
      if (c.y + 32 > bottom) Object.assign(c, page(c.label + " - continued"));
      doc.rect(c.x, c.y, c.w, 20).fill(fill);
      write(title, c.x + 6, c.y + 5, c.w - 12, 10, true); c.y += 26;
    }
    function table(c: Cursor, headers: string[], widths: number[], rows: { cells: string[]; bold?: boolean }[], size = 9.5, rowMin = 18, padding = 5, amounts = false) {
      const starts = [c.x]; for (const w of widths) starts.push(starts[starts.length - 1] + w);
      const header = () => {
        const lines = headers.map((h, i) => wrap(h, widths[i] - 8, 9, true));
        const h = Math.max(...lines.map(l => l.length)) * 10 + 8;
        doc.rect(c.x, c.y, c.w, h).fill(fill);
        lines.forEach((ls, i) => ls.forEach((s, j) => write(s, starts[i] + 4, c.y + 4 + j * 10, widths[i] - 8, 9, true)));
        c.y += h;
      };
      header();
      for (const row of rows) {
        const cells = row.cells.map((s, i) => {
          doc.font(row.bold ? bold : regular).fontSize(size);
          const display = amounts && i > 0 && doc.widthOfString(s) > widths[i] - 8 ? s.replaceAll(",", "") : s;
          return wrap(display, widths[i] - 8, size, row.bold);
        });
        const count = Math.max(...cells.map(l => l.length));
        const leading = size + 1.5;
        let offset = 0;
        while (offset < count) {
          if (bottom - c.y < Math.max(rowMin, leading + padding)) {
            const next = page(c.label + " - continued");
            c.y = next.y; header();
          }
          const capacity = Math.max(1, Math.floor((bottom - c.y - padding) / leading));
          const take = Math.min(count - offset, capacity), h = Math.max(rowMin, take * leading + padding);
          if (row.bold) doc.rect(c.x, c.y, c.w, h).fill("#f1f4f1");
          cells.forEach((ls, i) => ls.slice(offset, offset + take).forEach((s, j) => write(s, starts[i] + 4, c.y + 3 + j * leading, widths[i] - 8, size, row.bold, ink, amounts && i > 0 ? "right" : "left")));
          c.y += h; rule(c.x, c.y, c.w); offset += take;
        }
      }
      c.y += 6;
    }

    const urgentCustomers = v.customerUpcoming.filter(a => a.priority === "urgent" && !finishedTask(a.status));
    const severe = (report.activeHealth || []).filter((h: any) => ["severe", "critical"].includes(h.severity));
    const animalTag = (id: string) => (report.animals || []).find((a: any) => a.id === id)?.tagNumber || "Unknown animal";
    const c = page("Farm overview and milk");
    const cardW = (width - 24) / 4;
    [["Milk produced", `${num(v.totals.produced)} L`], ["Milk sold", `${num(v.totals.sold)} L`], ["Dairy sales", `Rs ${money(v.totals.sales)}`], ["Money received", `Rs ${money(v.totals.received)}`]].forEach(([label, value], i) => {
      const x = x0 + i * (cardW + 8); doc.rect(x, c.y, cardW, 51).lineWidth(.5).strokeColor(border).stroke();
      write(label, x + 7, c.y + 8, cardW - 14, 9.5, true); write(value, x + 7, c.y + 27, cardW - 14, 13, true);
    }); c.y += 61;
    paragraph(c, `${v.totals.recordedEntries}/${v.totals.expectedEntries} expected milk entries recorded.${v.totals.missingEntries ? ` ${v.totals.missingEntries} missing - production is a recorded subtotal.` : " All expected entries present."}`, 10, !!v.totals.missingEntries);
    paragraph(c, `Herd: ${v.herd.total} animals; ${v.herd.inMilk} giving milk; ${v.herd.dry} dry; ${v.herd.heifers} young females; ${v.herd.calves} calves.\nPregnant: ${v.herd.pregnant} (included above). Open health cases: ${v.totals.activeHealth}${severe.length ? ` (${severe.length} recorded severe)` : ""}.`, 9.5);
    paragraph(c, `${v.urgentActions.length + urgentCustomers.length} tasks explicitly marked URGENT.${severe.length ? ` Recorded severe health: ${severe.map((h: any) => animalTag(h.cattleId)).join(", ")}; review care record.` : ""} Care, work and customer summary follows milk.`, 9.5, true);
    if (v.restrictions.length) paragraph(c, `DO NOT SELL MILK: ${v.restrictions.map(a => a.tag).join(", ")}. Restrictions listed with the care summary.`, 10, true);
    c.y += 3;
    heading(c, `Milk by animal - ${date(v.coveredDate)} (litres)`);
    const sessions = v.sessions;
    const sessionName = (s: string) => s === "morning" ? "Morning" : s === "evening" ? "Evening" : s.replaceAll("_", " ");
    const numericWidth = 160 / (sessions.length + 1);
    const milkWidths = [112, ...sessions.map(() => numericWidth), numericWidth, 60, width - 332];
    const milkRows = v.milkRows.map(a => {
      const notes = sessions.filter(s => a.comparisons[s]?.isLow).map(s => `${sessionName(s)} ${Math.round(Math.abs(a.comparisons[s].deltaPercent || 0))}% below usual`);
      if (a.missingSessions.length) notes.push(`Missing ${a.missingSessions.map(sessionName).join(" / ")}`);
      if (a.withheld) notes.push("DO NOT SELL MILK");
      if (!notes.length && a.pmComparison.reason === "insufficient_history") notes.push("Not enough history");
      return { cells: [a.tag + (a.name ? ` ${a.name}` : ""), ...sessions.map(s => a.sessions[s] == null ? "Missing" : num(a.sessions[s])), a.total == null ? "Missing" : num(a.total) + (a.isSubtotal ? "*" : ""), a.pmComparison.usual == null ? "Unknown" : num(a.pmComparison.usual), notes.join("; ")], bold: a.withheld || a.missingSessions.length > 0 || sessions.some(s => a.comparisons[s]?.isLow) };
    });
    milkRows.push({ cells: ["TOTAL", ...sessions.map(s => num(v.milkRows.reduce((n, a) => n + Number(a.sessions[s] || 0), 0))), num(v.totals.produced) + (v.totals.missingEntries ? "*" : ""), "", v.totals.missingEntries ? "*Recorded subtotal" : "Entries complete"], bold: true });
    table(c, ["Animal", ...sessions.map(sessionName), "Total", "Usual evening", "Check / note"], milkWidths, milkRows, 10, 18);
    paragraph(c, `Usual evening = earlier evening average (${date(v.rules.historyFrom)}-${date(v.rules.historyTo)}; ${v.rules.minRecords}+ earlier days). Check either session only if BOTH ${v.rules.dropPercent}% and ${v.rules.minDropLitres} L below its own usual yield.`, 9);
    paragraph(c, "Missing is not zero. *A partial total uses recorded milk only. Discarded milk stays in production.", 9);
    paragraph(c, `Milk check (L): opening ${num(v.totals.opening)} + produced ${num(v.totals.produced)} - discarded at milking ${num(report.milk?.discardedAtMilking || 0)} - sold ${num(v.totals.sold)} - recorded uses / closing ${num(report.milk?.used || 0)} = ${num(v.totals.unallocated)} unexplained.`, 9, Math.abs(v.totals.unallocated) > .001);
    if (v.totals.previousClosing != null && Math.abs(v.totals.previousClosing - v.totals.opening) > .001) paragraph(c, `Check milk carried forward: previous closing ${num(v.totals.previousClosing)} L; opening ${num(v.totals.opening)} L.`, 9.5, true);

    const detail = page("Care, money and customer follow-ups"), detailPage = pages.length - 1;
    const leftWidth = 330, rightX = x0 + leftWidth + 12, rightWidth = width - leftWidth - 12;
    const left: Cursor = { ...detail, w: leftWidth, label: "Customer accounts" };
    heading(left, `Customer accounts - ${date(v.coveredDate)} (Rs)`);
    const fullCustomers: any[] = report.dairySales?.customers || [];
    const accountMap = new Map(brief.customers.map((a: any) => [a.id, a]));
    const customers = (fullCustomers.length ? fullCustomers : brief.customers).map((a: any) => {
      const own: any = accountMap.get(a.id) || a;
      return { id: a.id, name: a.name, sales: own.sales || 0, received: own.received || 0, owed: a.outstanding ?? own.debit ?? 0, advance: a.advance ?? own.credit ?? 0 };
    }).sort((a: any, b: any) => a.name.localeCompare(b.name));
    paragraph(left, `${customers.length} accounts. Sales/receipts for ${date(v.coveredDate)}; balances through that date.`, 9);
    const accounts = customers.map((a: any) => ({ cells: [a.name, money(a.sales), money(a.received), money(a.owed), money(a.advance)] }));
    accounts.push({ cells: ["TOTAL", money(v.totals.sales), money(v.totals.received), money(v.totals.outstanding), money(v.totals.advances)], bold: true });
    table(left, ["Customer", "Sales", "Received", "Still owes", "Advance"], [106, 56, 56, 56, 56], accounts, 9, 12.5, 2, true);
    paragraph(left, "Received = collected that day. Owes includes older bills; advance is separate customer credit.", 9);
    const unlinkedSales = v.totals.sales - customers.reduce((n: number, a: any) => n + Number(a.sales), 0);
    if (Math.abs(unlinkedSales) > .01) paragraph(left, `Sales total includes Rs ${money(unlinkedSales)} outside these accounts. See full print.`, 9);
    paragraph(left, `Expenses recorded: Rs ${money(v.totals.expenses)}.${!(report.finance?.expenses || []).length ? " No entries: costs not confirmed." : " Spending is not profit."}`, 9, true);

    doc.switchToPage(detailPage);
    const right: Cursor = { ...detail, x: rightX, w: rightWidth, label: "Care and follow-ups" };
    const actions = v.actions.filter(a => !finishedTask(a.status));
    const late = actions.filter(a => a.overdue).length, today = actions.filter(a => a.dueToday).length;
    heading(right, "Work needing attention");
    paragraph(right, `${actions.length} open: ${late} overdue; ${today} due today; ${actions.length - late - today} later / undated. ${actions.filter(a => !a.assignedTo || /unassigned|not assigned/i.test(a.assignedTo)).length} need a named person.`, 9.5, true);
    const due = (a: { dueDate?: string | null; dueTime?: string | null }) => `${a.dueDate ? date(a.dueDate) : "date needed"}${a.dueTime ? ` ${a.dueTime}` : ""}`;
    for (const a of v.urgentActions) paragraph(right, `URGENT: ${a.tag}: ${a.title}. ${a.assignedTo || "Person not assigned"}; ${due(a)}.${a.instructions ? ` ${a.instructions}` : ""}`, 9.5, true);
    for (const a of urgentCustomers) paragraph(right, `URGENT customer: ${a.customerName}: ${a.title}. ${a.assignedTo || "Person not assigned"}; ${due(a)}.${a.instructions ? ` ${a.instructions}` : ""}`, 9.5, true);
    if (!v.urgentActions.length && !urgentCustomers.length) paragraph(right, "No task explicitly marked urgent.", 9);
    if (severe.length) paragraph(right, `Recorded severe health: ${severe.map((a: any) => animalTag(a.cattleId)).join(", ")}. Review the care record.`, 9.5, true);
    const category = (a: BriefingAction) => /post.calving/i.test(a.title) ? "After-birth review" : /newborn|colostrum/i.test(a.title) ? "Newborn care" : /^health review/i.test(a.title) ? "Health reviews" : /expected calving date/i.test(a.title) ? "Record birth due dates" : /expected heat/i.test(a.title) ? "Breeding observations" : /pregnancy confirmation/i.test(a.title) ? "Pregnancy checks" : a.title;
    const groups = new Map<string, BriefingAction[]>();
    for (const a of actions.filter(a => !a.urgent)) { const key = category(a); groups.set(key, [...(groups.get(key) || []), a]); }
    for (const [label, group] of groups) {
      const tags = [...new Set(group.map(a => a.tag))].join(", ");
      const dates = group.map(a => a.dueDate).filter(Boolean).sort() as string[];
      const counts = [group.filter(a => a.overdue).length ? `${group.filter(a => a.overdue).length} overdue` : "", group.filter(a => a.dueToday).length ? `${group.filter(a => a.dueToday).length} today` : ""].filter(Boolean).join(", ") || `next ${dates[0] ? date(dates[0]) : "date needed"}`;
      paragraph(right, `${label} (${group.length}): ${tags}. ${counts}.`, 9, false, 3);
    }
    paragraph(right, "Grouped task summary. Use Full details print for dates, instructions and every future reminder.", 9, false, 6);

    function medicines(rows: BriefingMedicine[], label: string) {
      heading(right, label);
      if (!rows.length) { paragraph(right, "No administrations recorded. Not a confirmed 'none given'.", 9); return; }
      for (const m of rows) {
        const dose = m.dosage || (m.supplies.length ? m.supplies.map(s => `${s.name}: ${s.quantity} ${s.unit || "unit unknown"}`).join("; ") : "amount not recorded");
        paragraph(right, `${m.tag}: ${m.medicineName || "medicine name not recorded"}. ${dose}; ${m.route || "route not recorded"}. ${date(m.date)}, ${m.administeredAt ? stamp(m.administeredAt) : "time not recorded"}; ${m.administeredBy || "person not recorded"}.${m.withdrawalUntil ? ` Milk not for sale until ${stamp(m.withdrawalUntil)}; follow recorded release review.` : " Milk restriction not recorded: check care record."}`, 9.5);
      }
    }
    medicines(v.medicines, `Medicines given - ${date(v.coveredDate)}`);
    if (v.currentMedicines.length) medicines(v.currentMedicines, `Given today - ${date(v.actionDate)}`);
    for (const hold of v.restrictions) paragraph(right, `DO NOT SELL MILK: ${hold.tag}, through ${stamp(hold.until)}. Follow the recorded release review.`, 9.5, true);
    if (v.period === "morning") paragraph(right, `Today's morning update: ${num(v.currentMorning.total)} L from ${v.currentMorning.recordedAnimals}/${v.currentMorning.expectedAnimals} expected animals. Separate from yesterday's totals.`, 9);

    const activityGroups = new Map<string, typeof v.customerUpcoming>();
    for (const a of v.customerUpcoming) activityGroups.set(a.customerId, [...(activityGroups.get(a.customerId) || []), a]);
    heading(right, "Customer follow-ups");
    const billCount = v.customerUpcoming.filter(a => a.source === "payment_due").length;
    paragraph(right, `${v.customerUpcoming.length} reminders across ${activityGroups.size} customers${billCount ? `; ${billCount} are bill due-date reminders` : ""}. Grouped below; not separate farm tasks.`, 9);
    for (const [, group] of activityGroups) {
      const dates = group.map(a => a.dueDate).filter(Boolean).sort() as string[];
      const overdue = group.filter(a => a.dueDate && a.dueDate < v.actionDate).length;
      const dueToday = group.filter(a => a.dueDate === v.actionDate).length;
      const manual = group.filter(a => a.source === "manual").length;
      const status = [overdue ? `${overdue} overdue` : "", dueToday ? `${dueToday} today` : "", group.length - overdue - dueToday ? `${group.length - overdue - dueToday} later` : ""].filter(Boolean).join(", ");
      paragraph(right, `${group[0].customerName}: ${status || `${group.length} open`}${manual ? `; ${manual} recorded tasks` : ""}. Earliest ${dates[0] ? date(dates[0]) : "date needed"}.`, 9, false, 2);
      for (const a of group.filter(a => a.source === "manual" && a.priority !== "urgent"))
        paragraph(right, `${a.title}. ${a.assignedTo || "Person not assigned"}; ${due(a)}.`, 9, false, 3);
    }
    if (!activityGroups.size) paragraph(right, "No customer follow-ups recorded.", 9);
    const warnings = (report.stock || []).filter((a: any) => a.shortage || a.lowStock || a.expired?.length || a.expiring?.length || a.untracked);
    if (warnings.length) paragraph(right, `Stock to check: ${warnings.map((a: any) => `${a.name} (${num(a.available)} ${a.unit || "units"} usable${a.shortage ? `; ${num(a.shortage)} short` : ""})`).join("; ")}.`, 9, true);
    else paragraph(right, (report.stock || []).length ? "No stock warnings recorded." : "Feed / medicine stock not recorded.", 9);

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i); rule(x0, 802, width);
      write(`${v.period === "morning" ? "Morning" : "Evening"} ${i + 1}/${range.count} | ${pages[i]}`, x0, 809, width, 8.5, true, muted);
      write("Concise briefing. Full details print keeps the complete work, medicine and customer records.", x0, 823, width, 8, false, muted);
    }
    doc.end();
  });
}
