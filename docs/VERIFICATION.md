# Verification record — 30 September 2026

## Automated checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed TypeScript checking |
| `npm test` | 36 tests passed; 0 failed, skipped or cancelled |
| `npm run build` | Passed client and server production builds |
| `npm audit --omit=dev` | 0 reported vulnerabilities |
| `git diff --check` | Passed |

Integration tests use the real Express routes, session authentication, validation and transactional services with isolated PGlite SQL storage. They cover independent animal statuses; duplicate tags and dates; tenant ownership; permissions; repeat prescriptions and withdrawal; stock conversion, expiry and FEFO splitting; rollback and retry behavior; twins and parent links; pregnancy loss; 20-calf partial batch completion and exclusion; dynamic groups and individual diets; overdue recovery; legacy recurring tasks; complete daily snapshots and revisions; PDF/Excel sections; import preview and deduplication; payments; cutoff catch-up; repeatable additive migration and upgrade from a schema without the new tables/columns; database export/restore; zero and discarded milk; saleable milk reconciliation; bulk-entry rollback; protocol revisions; legacy-stock reconciliation; duplicate identity merge; farm-specific breeding dates; operational read APIs; dry-off status/diet reminders; and legacy treatment history/withdrawal.

Offline tests use IndexedDB emulation and controlled network failures. They cover persistence, farm separation, replaying a lost response with the same key, wrong-session rejection, visible revision conflicts and restricted cached views.

## Browser checks

Chrome was used against localhost with a synthetic farm, not the live database:

- Sign-in, dashboard and pregnant/lactating animal visibility.
- Medicine receipt: 2 × 100 ml packs became 200 ml in the lot register.
- Treatment: a 10 ml issue left 190 ml, with 10 ml reserved in the upcoming-work forecast and a repeat reminder.
- Bulk milk: a 12.5 L morning entry appeared in the complete daily report with fat/SNF, missing-evening-session detection, farm history and audit entry.
- Daily report controls, named staff, saved immutable revision, individual animal roster and animals with no activity.
- 390 × 844 mobile report and care views: no document or main-container horizontal overflow.
- No browser console errors were observed in the final checked local workflow.

## Boundaries

The production VPS and live farm database were not changed. Real WhatsApp delivery, production PostgreSQL `pg_dump`/`pg_restore`, external attachment storage were not exercised. SaaS subscription checkout remains the existing manual/placeholder flow; farm purchase/sale payment recording is implemented and tested. SQL backup restoration was verified in isolated PGlite. Offline queue behavior was tested with simulated network failures; this is not a claim that every legacy screen works offline.

The build reports an existing PostCSS `from` warning and a large client bundle warning (about 354 KB gzip). Both builds complete. No large-herd load test or independent security penetration test was performed.

Clinical and nutrition schedules need farm-specific approved content. The software supports their timing, evidence and stock consequences; it does not determine clinical treatment.
