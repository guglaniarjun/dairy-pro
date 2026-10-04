import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  Milk,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Panel, InputField, control } from "@/components/farm-forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { saveOfflineOperation, OfflineStatus } from "@/lib/offline";
import { queuedOperations, scopeFor } from "@/lib/offline-store";
import {
  bulkMilkRows,
  copyPreviousMilk,
  hasMilkDraft,
  prepareBulkMilk,
  type MilkDraft,
  type MilkDrafts,
  type MilkMeasurement,
  type MilkPreferences,
} from "@/lib/bulk-milk";
import { daySchema, farmDay } from "@shared/care";
import type { Cattle, MilkEntry } from "@shared/schema";

type DraftSessions = Record<string, MilkDrafts>;
const grid =
  "lg:grid lg:grid-cols-[minmax(140px,1.5fr)_repeat(3,minmax(90px,1fr))_minmax(120px,1fr)] lg:gap-3";

export default function BulkMilkPage() {
  const { user } = useAuth();
  return <BulkMilkForm key={scopeFor(user)} user={user} />;
}

function BulkMilkForm({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const scope = scopeFor(user);
  const storageKey = `dairyflow-data:${scope}:bulk-milk-drafts`;
  const [draftSessions, setDraftSessions] = useState<DraftSessions>(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return {};
      // Only restore field strings written by this screen.
      return Object.fromEntries(
        Object.entries(parsed)
          .filter(
            ([key, value]) =>
              /^\d{4}-\d{2}-\d{2}:(morning|evening|night)$/.test(key) &&
              value &&
              typeof value === "object",
          )
          .map(([key, value]) => [
            key,
            Object.fromEntries(
              Object.entries(value as MilkDrafts)
                .filter(([, row]) => row && typeof row === "object")
                .map(([id, row]) => [
                  id,
                  Object.fromEntries(
                    Object.entries(row).filter(
                      ([field, v]) =>
                        ["quantity", "fat", "snf", "destination"].includes(
                          field,
                        ) && typeof v === "string",
                    ),
                  ),
                ]),
            ),
          ]),
      );
    } catch {
      return {};
    }
  });
  const [selectedDate, setDate] = useState<string | null>(null);
  const [session, setSession] = useState("morning");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const cattle = useQuery<Cattle[]>({ queryKey: ["/api/cattle"] });
  const milk = useQuery<MilkEntry[]>({ queryKey: ["/api/milk"] });
  const preferences = useQuery<MilkPreferences>({
    queryKey: ["/api/operations/preferences"],
  });
  const outbox = useQuery({
    queryKey: ["bulk-milk-outbox", scope],
    queryFn: () => queuedOperations(scope),
  });
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: ["bulk-milk-outbox", scope],
      });
    };
    window.addEventListener("farm-outbox", refresh);
    return () => window.removeEventListener("farm-outbox", refresh);
  }, [scope]);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draftSessions));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [draftSessions, storageKey]);
  useEffect(() => {
    if (
      !storageError ||
      !Object.values(draftSessions).some((rows) =>
        Object.values(rows).some(hasMilkDraft),
      )
    )
      return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [storageError, draftSessions]);

  const prefs = preferences.data;
  const today = farmDay(prefs?.timezone);
  const date = selectedDate ?? today;
  const sessionKey = `${date}:${session}`;
  const drafts = draftSessions[sessionKey] || {};
  const queued: MilkMeasurement[] = (outbox.data || [])
    .filter((q) => q.path === "/milk-bulk")
    .flatMap((q) => q.data.entries || []);
  const rows = prefs
    ? bulkMilkRows(
        cattle.data || [],
        milk.data || [],
        queued,
        drafts,
        date,
        session,
        prefs,
      )
    : [];
  const loading =
    cattle.isPending ||
    milk.isPending ||
    preferences.isPending ||
    outbox.isPending;
  const loadError =
    cattle.isError || milk.isError || preferences.isError || outbox.isError;
  const validSession =
    !!prefs &&
    [
      "morning",
      "evening",
      ...(prefs.milkingSessions === 3 ? ["night"] : []),
    ].includes(session);
  const validDate = daySchema.safeParse(date).success && date <= today;
  const ready = rows.filter(
    (row) => row.status === "draft" && !row.issues.length,
  );
  const invalid = rows.filter((row) => row.issues.length);
  const saved = rows.filter((row) => row.status === "saved").length;
  const pending = rows.filter((row) => row.status === "queued").length;
  const missing = rows.length - saved - pending - ready.length;
  const totals = rows.reduce(
    (sum, row) => {
      const value =
        row.record ||
        (row.status === "draft" && !row.issues.length ? row.draft : null);
      if (value) {
        const quantity = Number(value.quantity) || 0;
        sum.total += quantity;
        sum[value.destination === "discarded" ? "discarded" : "bulk"] +=
          quantity;
      }
      return sum;
    },
    { total: 0, bulk: 0, discarded: 0 },
  );
  const visible = rows.filter(
    (row) =>
      `${row.animal.tagNumber} ${row.animal.name || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (filter === "all" ||
        (filter === "missing"
          ? ["missing", "draft"].includes(row.status)
          : row.status === filter)),
  );
  const canSave =
    !loading &&
    !loadError &&
    !busy &&
    validDate &&
    validSession &&
    ready.length > 0 &&
    invalid.length === 0;
  const setDrafts = (next: MilkDrafts) =>
    setDraftSessions((all) => ({ ...all, [sessionKey]: next }));
  const change = (id: string, field: keyof MilkDraft, value: string) => {
    setDraftSessions((all) => ({
      ...all,
      [sessionKey]: {
        ...all[sessionKey],
        [id]: { ...all[sessionKey]?.[id], [field]: value },
      },
    }));
    setMessage("");
    setError("");
  };
  const retry = () => {
    void Promise.all([
      cattle.refetch(),
      milk.refetch(),
      preferences.refetch(),
      outbox.refetch(),
    ]);
  };

  async function save() {
    if (!canSave || !prefs || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Re-read the durable queue before sending, including entries from another tab.
      const currentQueue = await queuedOperations(scope);
      const latestRows = bulkMilkRows(
        cattle.data || [],
        queryClient.getQueryData<MilkEntry[]>(["/api/milk"]) || [],
        currentQueue
          .filter((q) => q.path === "/milk-bulk")
          .flatMap((q) => q.data.entries || []),
        drafts,
        date,
        session,
        prefs,
      );
      const entries = prepareBulkMilk(latestRows, date, session, prefs, today);
      const result = await saveOfflineOperation(user, "/milk-bulk", {
        entries,
      });
      if (!result.queued)
        queryClient.setQueryData<MilkEntry[]>(
          ["/api/milk"],
          (previous = []) => [...previous, ...result.entries],
        );
      setDraftSessions((all) => {
        const next = { ...all[sessionKey] };
        for (const entry of entries) delete next[entry.cattleId];
        return { ...all, [sessionKey]: next };
      });
      setMessage(
        result.queued
          ? `${entries.length} entries saved on this device. Sync when online.`
          : `${entries.length} milk entries saved successfully.`,
      );
      await outbox.refetch();
      void queryClient.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save this session.");
      await outbox.refetch();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-5">
      <div>
        <Link
          href="/milk"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Milk records
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Milk className="h-6 w-6 text-primary" /> Bulk milk entry
        </h1>
        <p className="text-muted-foreground mt-1">
          Record one session for every lactating animal, including pregnant
          animals.
        </p>
      </div>
      <OfflineStatus user={user} />
      {storageError && (
        <p role="alert" className="text-sm text-destructive">
          Draft storage is unavailable. Keep this page open until you save.
        </p>
      )}
      <Panel
        title="Choose a session"
        description="Drafts stay with their date and session in this browser tab until saved. Blank litres mean missing; enter 0 for a measured zero."
      >
        <fieldset
          disabled={busy}
          className="flex flex-col sm:flex-row sm:items-end gap-3"
        >
          <InputField
            label="Date"
            type="date"
            value={date}
            max={today}
            required
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setDate(e.target.value);
              setMessage("");
              setError("");
            }}
          />
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Session</span>
            <select
              className={control}
              value={session}
              onChange={(e) => {
                setSession(e.target.value);
                setMessage("");
                setError("");
              }}
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              {prefs?.milkingSessions === 3 && (
                <option value="night">Night</option>
              )}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={
              loading ||
              loadError ||
              !validDate ||
              !validSession ||
              busy ||
              !rows.some((row) => row.status === "missing")
            }
            onClick={() => {
              const copied = copyPreviousMilk(
                rows,
                milk.data || [],
                drafts,
                date,
                session,
              );
              setDrafts(copied.drafts);
              setError("");
              setMessage(
                copied.count
                  ? `Copied ${copied.count} entries into untouched rows. Check actual measurements and destinations before saving.`
                  : "No matching measurements from yesterday for untouched rows.",
              );
            }}
          >
            <Copy className="w-4 h-4 mr-2" /> Copy yesterday into empty rows
          </Button>
        </fieldset>
        {!validDate && (
          <p role="alert" className="text-sm text-destructive">
            Choose a valid date that is not in the future.
          </p>
        )}
        {prefs && !validSession && (
          <p role="alert" className="text-sm text-destructive">
            Choose a configured milking session.
          </p>
        )}
      </Panel>
      {loading ? (
        <div
          role="status"
          aria-label="Loading bulk entry"
          className="space-y-3"
        >
          <p className="text-sm text-muted-foreground">
            Loading animals, saved entries and farm settings…
          </p>
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : loadError ? (
        <Panel title="Unable to load bulk entry">
          <p role="alert">
            {cattle.isError ? "Animals could not be loaded. " : ""}
            {milk.isError
              ? "Saved milk entries could not be loaded. Open this screen online first to use it offline. "
              : ""}
            {preferences.isError ? "Farm settings could not be loaded. " : ""}
            {outbox.isError ? "Device entry storage is unavailable. " : ""}
          </p>
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        </Panel>
      ) : rows.length === 0 ? (
        <Panel title="No lactating animals found">
          <p className="text-sm text-muted-foreground">
            Mark animals that are currently producing milk as lactating in their
            cattle profile.
          </p>
          <Link href="/cattle">
            <Button variant="outline">Review cattle</Button>
          </Link>
        </Panel>
      ) : (
        <>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            aria-label="Session summary"
          >
            {[
              ["Session total", `${totals.total.toFixed(2)} L`],
              ["Saved animals", `${saved} / ${rows.length}`],
              ["Ready to save", String(ready.length)],
              ["Still missing", String(missing)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Bulk: {totals.bulk.toFixed(2)} L · Discarded:{" "}
            {totals.discarded.toFixed(2)} L · Awaiting sync: {pending} animals.
            Totals include saved entries, queued entries and valid drafts for
            the listed animals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="relative flex-1">
              <span className="sr-only">Search animals</span>
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                className={`${control} pl-9`}
                placeholder="Search by tag or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              <span className="sr-only">Filter entry status</span>
              <select
                className={control}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All animals</option>
                <option value="missing">Not yet saved</option>
                <option value="draft">Drafts</option>
                <option value="saved">Saved</option>
                <option value="queued">Awaiting sync</option>
              </select>
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {visible.length} of {rows.length} animals. Saving includes
            all valid drafts, including rows hidden by filters.
          </p>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-4"
          >
            <fieldset
              disabled={busy}
              className="min-w-0 space-y-3 lg:space-y-0 lg:rounded-xl lg:border lg:bg-card lg:px-4"
            >
              <legend className="sr-only">Animal milk measurements</legend>
              <div
                aria-hidden="true"
                className={`${grid} hidden lg:grid border-b py-3 text-sm font-medium text-muted-foreground`}
              >
                <span>Animal</span>
                <span>Litres</span>
                <span>Fat %{prefs?.fatMandatory ? " *" : ""}</span>
                <span>SNF %{prefs?.snfMandatory ? " *" : ""}</span>
                <span>Destination</span>
              </div>
              {visible.map((row) => {
                const { animal, status, record, draft, issues } = row;
                const locked = status === "saved" || status === "queued";
                const value = record || draft;
                return (
                  <div
                    key={animal.id}
                    className="rounded-xl border bg-card p-4 lg:rounded-none lg:border-0 lg:border-b lg:last:border-b-0 lg:px-0"
                  >
                    <div
                      className={`${grid} grid grid-cols-2 gap-3 items-start`}
                    >
                      <div className="col-span-2 lg:col-span-1 min-w-0">
                        <p className="font-semibold break-words">
                          {animal.tagNumber}
                          {animal.name ? ` · ${animal.name}` : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge
                            variant={
                              status === "saved" ? "secondary" : "outline"
                            }
                          >
                            {status === "saved" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Saved
                              </>
                            ) : status === "queued" ? (
                              <>
                                <Clock3 className="w-3 h-3 mr-1" />
                                Awaiting sync
                              </>
                            ) : status === "draft" ? (
                              "Draft"
                            ) : (
                              "Missing"
                            )}
                          </Badge>
                          {animal.reproductiveStatus === "pregnant" && (
                            <span className="text-xs text-muted-foreground">
                              Pregnant
                            </span>
                          )}
                        </div>
                      </div>
                      {(["quantity", "fat", "snf"] as const).map((field) => {
                        const label =
                          field === "quantity"
                            ? "Litres"
                            : field === "fat"
                              ? "Fat %"
                              : "SNF %";
                        const required =
                          field === "quantity" ||
                          (field === "fat"
                            ? prefs?.fatMandatory
                            : prefs?.snfMandatory);
                        return (
                          <label
                            key={field}
                            className="min-w-0 block space-y-1 text-sm"
                          >
                            <span className="lg:sr-only">
                              {label}
                              {required ? " *" : ""}
                            </span>
                            <input
                              aria-label={`${animal.tagNumber} ${label}`}
                              aria-invalid={issues.length > 0 || undefined}
                              aria-describedby={
                                issues.length
                                  ? `milk-errors-${animal.id}`
                                  : undefined
                              }
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max={field === "quantity" ? "999999.99" : "100"}
                              step="0.01"
                              placeholder={
                                field === "quantity"
                                  ? "Not entered"
                                  : required
                                    ? "Required"
                                    : "Optional"
                              }
                              disabled={locked}
                              required={hasMilkDraft(draft) && required}
                              className={`${control} min-w-0 disabled:bg-muted/40 disabled:text-muted-foreground`}
                              value={value[field] ?? ""}
                              onChange={(e) =>
                                change(animal.id, field, e.target.value)
                              }
                            />
                          </label>
                        );
                      })}
                      <label className="min-w-0 block space-y-1 text-sm">
                        <span className="lg:sr-only">Destination</span>
                        <select
                          aria-label={`${animal.tagNumber} destination`}
                          className={`${control} disabled:bg-muted/40`}
                          disabled={locked}
                          value={value.destination || "bulk"}
                          onChange={(e) =>
                            change(animal.id, "destination", e.target.value)
                          }
                        >
                          <option value="bulk">Bulk</option>
                          <option value="discarded">Discarded</option>
                        </select>
                      </label>
                    </div>
                    {issues.length > 0 && (
                      <p
                        id={`milk-errors-${animal.id}`}
                        className="text-sm text-destructive mt-2"
                      >
                        {issues.join(" ")}
                      </p>
                    )}
                  </div>
                );
              })}
              {!visible.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  No animals match these filters.
                </p>
              )}
            </fieldset>
            {invalid.length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                Review {invalid.length} draft{" "}
                {invalid.length === 1 ? "row" : "rows"} before saving. Check all
                drafts if a filter hides them.
              </p>
            )}
            <div className="sticky bottom-0 z-10 rounded-xl border bg-background/95 backdrop-blur p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
              <div>
                <p className="font-medium">
                  {ready.length} entries ready ·{" "}
                  {ready
                    .reduce((sum, row) => sum + Number(row.draft.quantity), 0)
                    .toFixed(2)}{" "}
                  L
                </p>
                <p className="text-xs text-muted-foreground">
                  {saved + pending === rows.length
                    ? "Every animal is saved or awaiting sync."
                    : "Check measurements before saving. Saved and queued rows are protected."}
                </p>
              </div>
              <Button type="submit" disabled={!canSave}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {busy ? "Saving…" : "Save reviewed session"}
              </Button>
            </div>
          </form>
        </>
      )}
      {message && (
        <p role="status" className="rounded-lg border bg-primary/5 p-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
        >
          {error} Review queued entries above before retrying.
        </p>
      )}
    </div>
  );
}
