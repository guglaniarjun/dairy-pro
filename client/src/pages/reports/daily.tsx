import { dailyBrief } from "@shared/daily-brief";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Panel,
  InputField,
  EntryForm,
  SelectField,
  Details,
  control,
} from "@/components/farm-forms";
import { Button } from "@/components/ui/button";
import { farmDay, addDays, finishedTask } from "@shared/care";
import { SalesTable, currency } from "@/pages/sales/common";
import { coveredReportDate, matchesReportIdentity, type ReportPeriod } from "@shared/report-period";
import { briefingView } from "@shared/daily-briefing";
export default function DailyReportPage() {
  const routeSearch = useSearch();
  const [, navigate] = useLocation();
  const search = new URLSearchParams(routeSearch);
  const initialPeriod = (p: URLSearchParams) => (p.get("period") || (p.get("archive") ? "daily" : "morning")) as ReportPeriod;
  const [date, setDate] = useState(search.get("date") || farmDay()),
    [period, setPeriod] = useState<ReportPeriod>(initialPeriod(search)),
    [archive, setArchive] = useState(search.get("archive") || "auto"),
    [allAnimals, setAllAnimals] = useState(true),
    [query, setQuery] = useState("");
  useEffect(() => { const p = new URLSearchParams(routeSearch); setDate(p.get("date") || farmDay()); setPeriod(initialPeriod(p)); setArchive(p.get("archive") || "auto"); }, [routeSearch]);
  const chooseDate = (value: string, selectedPeriod = period) => { if (value) navigate(`/daily-report?date=${value}&period=${selectedPeriod}`); };
  const { user } = useAuth();
  const can = (p: string) => (user as any)?.tenantPermissions?.includes(p);
  const report = useQuery<any>({
    queryKey: [
      `/api/operations/daily-report?date=${date}&period=${period}${archive === "live" ? "&live=1" : archive !== "auto" ? `&id=${archive}` : ""}`,
    ],
    enabled: !!can("reports.view"),
  });
  const archives = useQuery<any[]>({
    queryKey: ["/api/operations/report-archive"],
    enabled: !!can("reports.view"),
  });
  const schedule = useQuery<any>({
    queryKey: ["/api/operations/report-schedule"],
    enabled: !!can("settings.manage"),
  });
  const r = report.data;
  const coveredDate = r?.date || coveredReportDate(date, period);
  const actionDate = r?.briefing?.actionDate || coveredDate;
  const brief = r ? dailyBrief(r) : null;
  const view = r?.briefing ? briefingView(r) : null;
  const actions = view?.actions || brief?.actions || [];
  const tags = (id: string) =>
    r?.animals.find((a: any) => a.id === id)?.tagNumber || "Farm";
  const exportUrl = (format: string) =>
    `/api/operations/daily-report/export?format=${format}&date=${date}&period=${period}${archive === "live" ? "&live=1" : archive !== "auto" ? `&id=${archive}` : ""}`;
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily farm report</h1>
          <p className="text-muted-foreground">
            Milk, customers, health and the work that needs your attention.
          </p>
        </div>
        <Link href="/care">
          <Button variant="outline">Care & Work</Button>
        </Link>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SelectField label="Report" value={period} onChange={(e: any) => chooseDate(date, e.target.value)} options={[
          { value: "morning", label: "Morning: yesterday's farm figures" },
          { value: "evening", label: "Evening: this day's farm figures" },
          { value: "daily", label: "Original daily report / older archives" },
        ]} />
        <InputField
          label={period === "daily" ? "Farm figures date" : "Briefing / delivery date"}
          type="date"
          value={date}
          onChange={(e: any) => {
            chooseDate(e.target.value);
          }}
        />
        <div className="flex gap-2"><Button variant="outline" onClick={() => chooseDate(addDays(farmDay(r?.timezone), -1))}>Yesterday</Button>
        <Button variant="outline" onClick={() => chooseDate(farmDay(r?.timezone))}>Today</Button></div>
        <SelectField
          label="Version"
          value={archive}
          onChange={(e: any) => setArchive(e.target.value)}
          options={[
            { value: "auto", label: "Latest saved report / current preview" },
            { value: "live", label: "Rebuild preview from current records" },
            ...(archives.data || [])
              .filter((a) => matchesReportIdentity(a, date, period))
              .map((a) => ({
                value: a.id,
                label: `Revision ${a.revision} · ${new Date(a.createdAt).toLocaleString()}`,
              })),
          ]}
        />
        <a href={exportUrl("pdf")}>
          <Button variant="outline" disabled={!r}>
            Download {period === "daily" ? "daily" : period} PDF
          </Button>
        </a>
        {period === "daily" && <a href={exportUrl("xlsx")}>
          <Button variant="outline" disabled={!r}>
            Excel
          </Button>
        </a>}
        <Button asChild variant="outline"><a href={`${exportUrl("pdf")}&inline=1`} target="_blank" rel="noopener">Open print layout</a></Button>
        {period !== "daily" && <Button asChild variant="outline"><a href={`${exportUrl("pdf")}&layout=full&inline=1`} target="_blank" rel="noopener">Print full details</a></Button>}
      </div>
      <p className="text-sm text-muted-foreground">
        {period === "daily" ? `Original daily report for ${coveredDate}.` : `${period === "morning" ? "Morning" : "Evening"} briefing on ${date}: farm figures for ${coveredDate}, with work for ${date}.`}
        {period !== "daily" && " Use the short print layout for the daily briefing. Full details include every task instruction and individual bill reminder."}
      </p>
      {!can("reports.view") && (
        <p role="alert">Your role does not have report access.</p>
      )}
      {report.isLoading && <p>Building complete report…</p>}
      {report.error && (
        <p className="text-destructive" role="alert">
          Report could not be loaded: {report.error.message}
        </p>
      )}
      {r && (
        <>
          <p className="text-xs text-muted-foreground">
            Farm timezone: {r.timezone} · Generated:{" "}
            {new Date(r.generatedAt).toLocaleString(undefined, { timeZone: r.timezone })} ·{" "}
            {r.revision ? `Saved revision ${r.revision}` : "Live preview"}.
            Farm figures cover {coveredDate}. Animal status and open work are shown as at generation.
            {view && ` Work date: ${view.actionDate}.`}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Milk produced", `${r.milk.produced.toFixed(2)} L`],
              ["Milk sold", `${r.milk.sold.toFixed(2)} L`],
              view ? ["Dairy sales", currency(view.totals.sales)] : ["Outstanding actions", actions.filter((t: any) => !finishedTask(t.status) && (!t.dueDate || t.dueDate <= actionDate)).length || 0],
              view ? ["Money received", currency(view.totals.received)] : ["Milk needing allocation", `${r.milk.unallocated.toFixed(2)} L`],
            ].map(([k, v]) => (
              <Panel key={k} title={k}>
                <p className="text-2xl font-bold">{v}</p>
              </Panel>
            ))}
          </div>
          {view && <>
            <p className="text-sm">Herd: {view.herd.total} animals · {view.herd.inMilk} giving milk · {view.herd.dry} dry · {view.herd.heifers} young females · {view.herd.calves} calves. Pregnant: {view.herd.pregnant} (included in these groups).</p>
            <Panel title={`Act now / do not sell this milk — ${view.actionDate}`}>
              {view.urgentActions.map(t => <div className="border-b py-2 text-sm" key={t.id}><strong>URGENT: {t.tag} · {t.title}</strong><p>{t.assignedTo || "Person not assigned"} · {t.dueDate || "No due date"} {t.dueTime || ""}</p>{t.instructions && <p>{t.instructions}</p>}</div>)}
              {view.restrictions.map(a => <p className="py-2 font-medium" key={a.cattleId}>Do not sell milk from {a.tag}. Recorded restriction through {a.until}.</p>)}
              {!view.urgentActions.length && !view.restrictions.length && <p>No urgent tasks or active milk restrictions recorded.</p>}
            </Panel>
          </>}
          <Panel title="Milk production and reconciliation">
            <p className="text-sm">
              Opening {r.milk.opening || 0} L + produced {r.milk.produced} L −
              discarded at milking {r.milk.discardedAtMilking || 0} L − sold{" "}
              {r.milk.sold} L − recorded uses / closing stock {r.milk.used} L ={" "}
              {r.milk.unallocated} L unallocated.
            </p>
            {r.milk.unallocated < 0 && (
              <p role="alert" className="text-destructive">
                Recorded sales and uses exceed production. Review opening stock
                and entries.
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm tabular-nums">
                <caption className="text-left p-3 text-xs text-muted-foreground">Litres per cow. A dash means not recorded; 0.0 is a recorded zero. All milking animals are included.</caption>
                <thead className="bg-muted/60"><tr className="text-left"><th className="p-3">Cattle</th>{brief?.sessions.map(session => <th className="p-3 capitalize text-right" key={session}>{session}</th>)}<th className="p-3 text-right">Total</th>{view && <><th className="p-3 text-right">Usual evening</th><th className="p-3">Check / note</th></>}</tr></thead>
                <tbody>{brief?.milkRows.map(row => <tr key={row.cattleId as string} className="border-t">
                  <td className="p-3"><Link href={`/milk/new?cattleId=${row.cattleId}&date=${coveredDate}`} className="text-primary font-medium underline">{row.tag}</Link><span className="block text-xs text-muted-foreground">{row.name}</span></td>
                  {brief.sessions.map(session => <td key={session} className="p-3 text-right">{row.sessions[session] == null ? <span className="text-amber-700" aria-label="Not recorded">—</span> : Number(row.sessions[session]).toFixed(1)}</td>)}
                  <td className="p-3 text-right font-semibold">{row.total == null ? "—" : row.total.toFixed(1)}{row.discarded > 0 && <span className="block text-xs text-destructive">{row.discarded} discarded</span>}</td>
                  {view && (() => { const detail = view.milkRows.find(a => a.cattleId === row.cattleId); return <><td className="p-3 text-right">{detail?.pmComparison.usual == null ? "Not enough history" : detail.pmComparison.usual.toFixed(1)}</td><td className="p-3">{view.sessions.filter(session => detail?.comparisons[session]?.isLow).map(session => <strong key={session} className="block text-amber-700 capitalize">{session} milk {Math.abs(detail?.comparisons[session]?.deltaPercent || 0).toFixed(0)}% below usual: check</strong>)}{!!detail?.missingSessions.length && <span className="block">Not recorded: {detail.missingSessions.join(", ")}</span>}{detail?.withheld && <strong className="block text-destructive">Do not sell milk</strong>}{detail?.isSubtotal && <span className="block">Recorded subtotal</span>}</td></>; })()}
                </tr>)}</tbody>
                <tfoot className="bg-muted/60 font-semibold"><tr><td className="p-3">Total</td>{brief?.sessions.map(session => <td className="p-3 text-right" key={session}>{brief.milkRows.reduce((n, row) => n + Number(row.sessions[session] || 0), 0).toFixed(1)}</td>)}<td className="p-3 text-right">{r.milk.produced.toFixed(1)}</td>{view && <td colSpan={2} className="p-3">{view.totals.missingEntries ? "Recorded subtotal: entries missing" : "All expected entries recorded"}</td>}</tr></tfoot>
              </table>
            </div>
            <p className="text-sm text-amber-700">
              Missing sessions:{" "}
              {r.milk.missing
                .map((a: any) => `${a.tag} (${a.missingSessions})`)
                .join(", ") || "None"}
              . Missing entries are not counted as zero production.
            </p>
            <details>
              <summary className="cursor-pointer text-sm">
                Sales and uses
              </summary>
              <Details value={[...r.milk.sales, ...r.milk.dispositions]} />
            </details>
          </Panel>
          {view && <Panel title={`Medicines actually given — ${coveredDate}`} description="Administration records only. Planned medicine and health notes are shown separately.">
            {view.medicines.map(m => <div key={m.id} className="border-b py-3 text-sm"><strong>{m.tag}: {m.medicineName || "Recorded care supplies"}</strong><p>{[m.dosage, m.route].filter(Boolean).join(" · ") || "Amount / route not recorded"} · {m.administeredAt || "Administration time not recorded"} · {m.administeredBy || "Person not recorded"}</p>{m.supplies.length > 0 && <p>Recorded supplies: {m.supplies.map(s => `${s.name} ${s.quantity} ${s.unit || ""}`).join(", ")}</p>}{m.withdrawalUntil && <p>Recorded milk restriction through {m.withdrawalUntil}.</p>}</div>)}
            {!view.medicines.length && <p>No medicine administrations recorded for this date. This does not confirm that none were given.</p>}
            {view.period === "morning" && <div className="mt-3"><strong>Latest morning update — {view.actionDate}</strong><p>{view.currentMorning.total.toFixed(1)} L recorded from {view.currentMorning.recordedAnimals} of {view.currentMorning.expectedAnimals} expected animals. This is separate from yesterday's milk.</p>{view.currentMedicines.map(m => <p className="mt-2" key={m.id}>{m.tag}: {m.medicineName || "Recorded care supplies"}, {m.dosage || "amount not recorded"} {m.route || ""} · {m.administeredAt || "time not recorded"} · {m.administeredBy || "person not recorded"}</p>)}</div>}
          </Panel>}
          {can("milk.manage") && !r.revision && (
            <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Record milk allocation or correct an entry</summary><div className="grid lg:grid-cols-2 gap-5 mt-4">
              <Panel title="Record milk use / closing balance">
                <EntryForm
                  onSave={async (d) => {
                    const result = await (
                      await apiRequest(
                        "POST",
                        "/api/operations/milk-disposition",
                        { ...d, date: coveredDate, quantity: Number(d.quantity) },
                      )
                    ).json();
                    queryClient.invalidateQueries();
                    return result;
                  }}
                >
                  <SelectField
                    label="Milk allocation"
                    name="kind"
                    required
                    options={[
                      "opening_stock",
                      "calf_feed",
                      "household",
                      "discarded",
                      "closing_stock",
                    ]}
                  />
                  <InputField
                    label="Litres"
                    name="quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                  <InputField
                    label="Reference / reason"
                    name="notes"
                    required
                  />
                </EntryForm>
              </Panel>
              <Panel title="Correct a milk entry">
                <EntryForm
                  onSave={async (d) => {
                    const result = await (
                      await apiRequest(
                        "PATCH",
                        `/api/operations/milk/${d.entryId}`,
                        { quantity: Number(d.quantity), reason: d.reason },
                      )
                    ).json();
                    queryClient.invalidateQueries();
                    return result;
                  }}
                >
                  <SelectField
                    label="Entry to correct"
                    name="entryId"
                    required
                    options={r.milk.entries.map((m: any) => ({
                      value: m.id,
                      label: `${tags(m.cattleId)} · ${m.session} · ${m.quantity} L`,
                    }))}
                  />
                  <InputField
                    label="Correct total litres"
                    name="quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                  <InputField
                    label="Correction reason"
                    name="reason"
                    required
                  />
                </EntryForm>
              </Panel>
            </div></details>
          )}
          <Panel title="Health issues and treatments">
            {brief?.health.map(h => <div className="border-b py-2 text-sm" key={h.id}><Link className="text-primary underline" href={`/health?cattleId=${h.cattleId}`}>{h.text}</Link><span className="block text-xs text-muted-foreground">{h.date}</span></div>)}
            {!brief?.health.length && <p className="text-sm text-muted-foreground">No health issues or treatments recorded for this report.</p>}
          </Panel>
          <Panel title="Due, overdue and upcoming work" description="Today, tomorrow and the next 30 days. Open actions repeat daily until recorded or completed; overdue work stays visible.">
            {actions.map((t: any) => <div className="py-3 border-b text-sm" key={t.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><strong>{t.tag} · {t.title}</strong><span className={t.dueDate < actionDate && t.status !== "completed" ? "font-semibold text-destructive" : "font-medium"}>{t.countdown}</span></div>
              <p className="text-muted-foreground">{t.dueDate || "No due date"} · {t.assignedTo || "Unassigned"} · {t.status}</p>
              {t.instructions && <p className="mt-1 whitespace-pre-line">{t.instructions}</p>}
              {!r.revision && t.status !== "completed" && <Link className="inline-flex min-h-10 items-center text-primary underline" href={t.href || "/care?tab=work"}>Open action →</Link>}
            </div>)}
            {!actions.length && <p>No actions in the reporting window.</p>}
          </Panel>
          {!!view?.customerUpcoming.length && <Panel title="Upcoming customer work">
            {view.customerUpcoming.map(t => <div key={t.id} className="border-b py-2 text-sm"><Link href={t.href} className="font-medium text-primary underline">{t.customerName}: {t.title}</Link><p>{t.dueDate || "No due date"} {t.dueTime || ""} · {t.assignedTo || "Person not assigned"} · {t.status}</p>{t.instructions && <p>{t.instructions}</p>}</div>)}
          </Panel>}
          <Panel title="Batch-specific work">
            {r.batches.map((b: any) => (
              <details key={b.id} className="p-3 border rounded mb-2" open>
                <summary className="font-medium">
                  {b.title}: {b.completed}/{b.total} completed
                </summary>
                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  {b.animals.map((a: any) => (
                    <p className="text-sm" key={a.id}>
                      Tag {a.tag} · {a.status}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </p>
                  ))}
                </div>
              </details>
            ))}
            {!r.batches.length && <p>No batches in this reporting window.</p>}
          </Panel>
          <Panel title="Individual animal and calf records">
            <div className="flex flex-wrap gap-4">
              <input
                className={control + " max-w-sm"}
                aria-label="Find animal"
                placeholder="Find tag or name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label className="flex gap-2 text-sm items-center">
                <input
                  type="checkbox"
                  checked={allAnimals}
                  onChange={(e) => setAllAnimals(e.target.checked)}
                />
                Include animals with no activity
              </label>
            </div>
            {r.animals
              .filter(
                (a: any) =>
                  (allAnimals || !a.noActivity) &&
                  `${a.tagNumber} ${a.name || ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((a: any) => (
                <details key={a.id} className="p-3 border rounded-lg mb-2">
                  <summary className="cursor-pointer">
                    <strong>
                      {a.tagNumber} {a.name}
                    </strong>{" "}
                    · {a.lifeStage || a.stage} ·{" "}
                    {a.productionStatus || "Production status needs review"} ·{" "}
                    {a.reproductiveStatus || "Reproduction status needs review"}
                    {a.noActivity ? " · No entries for this day" : ""}
                  </summary>
                  <div className="space-y-3 mt-3">
                    <p className="text-sm">
                      Health: {a.healthStatus} · Pen: {a.pen || "—"} · Weight:{" "}
                      {a.weightKg || "—"} kg · Expected delivery:{" "}
                      {a.expectedCalvingDate || "—"}
                    </p>
                    {a.milkWithholdUntil &&
                      new Date(a.milkWithholdUntil) > new Date(r.generatedAt) && (
                        <p className="text-destructive text-sm">
                          Milk withdrawal through {a.milkWithholdUntil}
                        </p>
                      )}
                    <Details value={a.events} />
                    <Details value={a.entries} />
                    <Details value={a.tasks} />
                  </div>
                </details>
              ))}
          </Panel>
          <Panel title="Medicine, feed and consumable stock">
            {r.stock
              .filter(
                (i: any) =>
                  i.shortage ||
                  i.lowStock ||
                  i.expired.length ||
                  i.expiring.length ||
                  i.untracked,
              )
              .map((i: any) => (
                <p key={i.id} className="text-sm">
                  {i.name}: {i.available} {i.unit} usable; {i.required} planned;
                  shortage {i.shortage}; {i.expired.length} expired lots;{" "}
                  {i.untracked} untracked.
                </p>
              ))}
            <details>
              <summary>All stock and today's movements</summary>
              <Details value={r.stock} />
              <Details value={r.stockMovements} />
            </details>
          </Panel>
          {r.dairySales && <Panel title="Dairy sales, receipts and customer balances">
            <SalesTable entries={r.dairySales.entries} />
            <div className="overflow-x-auto"><table className="w-full text-sm tabular-nums"><caption className="text-left py-2">Customer accounts: debit is owed to the farm; credit is the customer's advance.</caption><thead><tr className="text-left border-b"><th className="p-2">Customer</th><th className="p-2">Sales</th><th className="p-2">Received</th><th className="p-2">Debit</th><th className="p-2">Credit</th></tr></thead><tbody>{brief?.customers.map((c: any) => <tr key={c.id} className="border-b"><td className="p-2">{c.name}</td><td className="p-2">{currency(c.sales)}</td><td className="p-2">{currency(c.received)}</td><td className="p-2">{currency(c.debit)}</td><td className="p-2">{currency(c.credit)}</td></tr>)}</tbody></table></div>

            <p className="text-sm">Payments received: {currency(r.dairySales.payments.reduce((n: number, p: any) => n + Number(p.amount), 0))} · Outstanding as of report date: {currency(r.dairySales.customers.reduce((n: number, c: any) => n + Number(c.outstanding), 0))} · Customer advances: {currency(r.dairySales.customers.reduce((n: number, c: any) => n + Number(c.advance || 0), 0))}</p>
            <details><summary>Customer balances, receipts and dairy stock</summary><Details value={r.dairySales.customers} /><Details value={r.dairySales.payments} /><Details value={r.dairySales.products} /><Details value={r.dairySales.stockMovements} /></details>
          </Panel>}
          <Panel title="Finance, farm entries and corrections">
            <details>
              <summary>Financial entries and allocated costs</summary>
              <Details value={r.finance} />
            </details>
            <details>
              <summary>Every farm event ({r.events.length})</summary>
              <Details value={r.events} />
            </details>
            <details>
              <summary>Other entries ({r.entries.length})</summary>
              <Details value={r.entries} />
            </details>
            <details>
              <summary>
                Audit log: who entered or changed data ({r.audit.length})
              </summary>
              <Details value={r.audit} />
            </details>
          </Panel>
          <Panel
            title="Archive this report"
            description="A saved revision remains unchanged. Generate another revision after late entries or corrections."
          >
            <EntryForm
              label="Save report revision"
              onSave={async () => {
                const saved = await (
                  await apiRequest("POST", "/api/operations/daily-report", {
                    date,
                    period,
                  })
                ).json();
                setArchive(saved.reportId);
                queryClient.invalidateQueries({
                  queryKey: ["/api/operations/report-archive"],
                });
                return saved;
              }}
            >
              <p className="text-sm">Save the {period} report for {date}{period !== "daily" ? `, covering farm figures dated ${coveredDate}` : ""}.</p>
            </EntryForm>
          </Panel>
        </>
      )}
      {can("settings.manage") && (
        <Panel
          title="Automatic morning and evening reports"
          description="Times use the farm's timezone. Each period keeps its own saved report and catches up after downtime. Existing single-cutoff schedules stay unchanged until you choose two daily briefings. Recipients receive a summary and a login-protected link when the gateway is connected."
        >
          <EntryForm
            label="Save report schedule"
            reset={false}
            onSave={async (d) => {
              const result = await (
                await apiRequest("POST", "/api/operations/report-schedule", {
                  ...d,
                  recipients: String(d.recipients)
                    .split(/[\s,]+/)
                    .filter(Boolean),
                })
              ).json();
              queryClient.invalidateQueries({
                queryKey: ["/api/operations/report-schedule"],
              });
              return result;
            }}
          >
            <div className="grid sm:grid-cols-3 gap-3" key={`${schedule.data?.id}-${schedule.data?.mode}`}>
              <SelectField label="Reports to generate" name="mode" defaultValue={schedule.data?.mode || "briefings"} options={[
                { value: "briefings", label: "Morning and evening" },
                { value: "legacy", label: "Original single daily report" },
              ]} required />
              <InputField label="Morning report time" name="morningTime" type="time" defaultValue={schedule.data?.morningTime || "07:30"} required />
              <InputField label="Evening report time" name="eveningTime" type="time" defaultValue={schedule.data?.eveningTime || "19:30"} required />
              <InputField
                label="Original daily cutoff (single report only)"
                name="cutoff"
                type="time"
                defaultValue={schedule.data?.cutoff || "23:00"}
                required
              />
              <SelectField
                label="Schedule"
                name="status"
                defaultValue={schedule.data?.status || "paused"}
                options={["active", "paused"]}
                required
              />
              <InputField
                label="Approved WhatsApp recipients (country code)"
                name="recipients"
                defaultValue={(schedule.data?.recipients || []).join(", ")}
              />
            </div>
          </EntryForm>
        </Panel>
      )}
    </div>
  );
}
