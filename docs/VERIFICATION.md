# Verification record — 30 September 2026

## Customer account release — 30 October 2026

- Deployed application commit `15b9e5dadcab61ee440561cee1e5d519d332ff5b` to the existing Dairy Pro VPS.
- All 57 tests passed. TypeScript checking and the production build passed locally; checking with the preserved owner integration and the production build also passed on the VPS.
- Account tests cover the nine-day ₹100-sale example, excess payments, advance before the first sale, partial coverage, immediate payments, oldest-debt allocation, historical cutoffs, backdated entries, receipt retry deduplication, stale-balance rejection, rollback, legacy migration, due dates and overdue amounts.
- Browser checks in the isolated farm verified bulk saving, receipt preview and saving, individual advance use, and the chronological ledger with green advance/red due balances. No browser console errors were observed. All test transactions remained in the isolated database.
- Backed up the production database before migration. PostgreSQL 18 `pg_restore --list` verified the custom archive. Applied all four new account columns, nullable receipt sale references, legacy term conversion and due-date backfill; no existing sales were left without due dates.
- Compared pre/post migration hashes of existing sale amounts and identifying fields, receipts with payment modes/references, and customer identities. They matched exactly.
- Preserved the server-only owner-login files and hooks; both owner-file checksums matched. Restarted only the Dairy Pro PM2 application, verified its health check and public Sales HTTPS response, and checked the authenticated live Customer Details ledger and Receive Payment form.
- The first deployment attempt stopped before migration because the environment omitted development build tools. Re-running the guarded deployment with development dependencies available completed successfully; the production environment was loaded before restart.
- Deployment used the existing SSH workflow because GitHub Actions was previously blocked by account billing. Main commits skip Actions to avoid its hard reset removing the production-only owner overlay. The overlay remains backed up under the server's ignored deployment state.
- Live and isolated-demo screenshots are in the local ignored `.deploy-state` directory. Existing customer transactions were not edited or supplemented during live browser verification.

## Sales release — 30 October 2026

- Application commit: `2c414e0b920c98dc678b990265f793fcea62b3af`.
- Type checking, all 51 tests and the production build passed locally. Type checking and the production build also passed on the VPS with its existing Command Center integration preserved.
- GitHub Actions could not start because of an account billing restriction. Deployment ran over the existing authenticated SSH connection as the application owner, using `scripts/deploy-vps.sh` with schema migration enabled and credential reset disabled.
- Backed up the production database before migrating. PostgreSQL 18 `pg_restore --list` verified the resulting custom-format archive; the archive and checksum remain outside the public repository on the VPS.
- Applied the additive sales migration and verified all five new tables. The Dairy Pro PM2 service restarted and its health check passed. Other application processes were not restarted.
- Verified the authenticated live Sales and Customer Details screens and the public HTTPS Sales route. Initialized the six standard product definitions in the selected farm, with rates left for the user to configure. No test customers, sales or payment records were inserted in production.
- Preserved the server-only `owner-bridge.ts`, `owner-grant.ts` and their three integration lines in `server/index.ts` and `server/routes.ts`. Their original files, checksums and Git diff are backed up in the server's ignored deployment-state directory. Future deployments must preserve or deliberately integrate this overlay; a blind hard reset would remove the tracked-file hooks.
- Live screenshots are stored in the ignored local `.deploy-state` directory.

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

Production deployment was completed after the local checks, as recorded below. Real WhatsApp delivery and external attachment storage were not exercised. SaaS subscription checkout remains the existing manual/placeholder flow; farm purchase/sale payment recording is implemented and tested. SQL backup restoration was verified in isolated PGlite; the production PostgreSQL backup archive was checked for readability, without restoring over the live database. Offline queue behavior was tested with simulated network failures; this is not a claim that every legacy screen works offline.

The build reports an existing PostCSS `from` warning and a large client bundle warning (about 354 KB gzip). Both builds complete. No large-herd load test or independent security penetration test was performed.

Clinical and nutrition schedules need farm-specific approved content. The software supports their timing, evidence and stock consequences; it does not determine clinical treatment.

## Production deployment — 30 September 2026

- Application commit: `10cb23954edc67364cef59a1590b304c0d144d2c`.
- [Deployment run 36739164803](https://github.com/guglaniarjun/dairy-pro/actions/runs/36739164803) passed TypeScript checks, all 36 tests, the production build and deployment.
- Created a nonempty PostgreSQL custom-format backup before applying the additive migration. PostgreSQL 18 `pg_restore --list` successfully read the archive. The backup remains on the VPS outside the public repository.
- Applied `migrations/upgrade-existing.sql`; the deployment recorded the successful application commit.
- Confirmed the Dairy Pro PM2 process was online and its application processes used the isolated Node 22 runtime.
- The public HTTPS daily-report route returned HTTP 200. The existing authenticated Chrome session loaded the new Care & Work and complete Daily Report screens with no observed browser console errors.
- Live verification was read-only: no synthetic farm records, treatments, stock movements or outbound messages were created.
- Live screenshots remain in the ignored local `.deploy-state` directory, outside the public repository.
