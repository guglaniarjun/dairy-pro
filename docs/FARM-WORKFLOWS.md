# Complete daily farm operations

Implemented in the `codex/complete-farm-workflows` branch. The local implementation and synthetic test database are separate from the live farm. This document describes the new workflows; older screenshots and feature descriptions in README may describe the previous interface.

## What staff use

| Screen | Purpose |
| --- | --- |
| Care & Work → Today's work | Due and overdue actions, future work, responsible staff, evidence, postponement, cancellation and exclusions. Completed work remains in history. |
| Animal care | Record treatment, deworming, vaccination, expected calving, dry-off, calving, pregnancy loss, calf feeding, colostrum, weights, weaning, observations and pen changes. |
| Groups & batches | Create manual groups or groups selected by animal status, age, weight or pen. Schedule one task per animal; complete a subset and retain exclusions with reasons. |
| Care protocols | Draft and approve versioned care plans, including steps 15 or 10 days before expected calving and repeat intervals. Medicines, quantities, withdrawal periods and clinical instructions come from the farm's approved plan. |
| Diet plans | Approved individual and group diets with start/end dates, ingredients and quantities. Individual plans take priority. Conflicting group plans require review. Record actual feeding to deduct stock and allocate cost. |
| Stock lots | Receive medicines, feed and consumables with pack conversion, supplier batch, expiry, invoice and location. Track opening, expiry after opening, returns, waste and count adjustments. Assign older untracked balances to lots without increasing total stock. |
| Data review | Find duplicate tags, missing birth dates and ambiguous legacy statuses. Preview duplicate merges, check conflicts and revisions, retain history and parent links. |
| Milk → Bulk entry | Record a whole session, including pregnant animals that are still lactating. Review copied measurements. Blank means missing; zero is a recorded measurement. |
| Daily Report | One report with production, every animal's daily entries, completed and pending work, batches, stock, costs, other farm entries and audit history. |

## Lifecycle behavior

- Production, life stage, reproductive status and health status are independent. Pregnancy does not remove an animal from milking.
- Linked service and pregnancy-test records use the farm's configured gestation, heat-observation and testing intervals. Predictions remain distinct from confirmed events.
- Recording or revising expected calving schedules dry-off, calving preparation and approved relative-date protocol steps. Completed steps retain their original evidence.
- Completing the generated dry-off task changes production status and creates a diet-review task. A dynamic dry-cow group can then select its reviewed dry-period diet.
- Calving creates calf identities, mother links, birth history, newborn assessment, approved birth/age plans and maternal postpartum review. Twin births are supported.
- Pregnancy loss cancels pending work for that pregnancy and creates a veterinary-review task. Staff record the reviewed treatment and follow-up plan.
- Clinical repeats become dated tasks. Completion consumes usable stock, records evidence and cost, and applies the recorded withdrawal period in one transaction.
- A revised expected-calving or age protocol retires pending work from the prior version. Completed corresponding steps are not repeated. Event-triggered courses retain the version under which they were started.
- Overdue tasks persist through downtime. Reading an alert does not complete its task. Duplicate retries do not consume stock again.

## The complete daily report

The report includes milk by animal and session; missing sessions; saleable and discarded milk; opening stock, sales, other uses and closing balance; daily animal/calf histories; due/overdue actions and the next 14 days of work; each batch member's status and evidence; stock movements, shortages and expiry; financial entries and animal costs; and who entered or changed data.

The full roster includes animals without entries, so silence is visible. Activity includes both entries dated on the report day and late entries entered that day. The screen explicitly states that current animal/task status reflects generation time. Saved revisions preserve that exact snapshot. Later corrections require a new revision.

PDF, Excel and print views are available. The Excel workbook contains separate sheets for all report sections. The PDF includes the full detail, so a large farm/day can produce a long document. Configure `REPORT_FONT_PATH` to a server-installed font supporting the farm's scripts when non-Latin names must render in PDF.

Automatic reports run at the chosen farm-local cutoff and catch up after downtime. Approved WhatsApp recipients receive a summary and an authenticated report link when the existing gateway is connected. No real messages were sent during development.

## Inventory and milk controls

- Quantities are stored in each item's base unit. Two 100 ml bottles create 200 ml of stock; cost is converted consistently.
- Consumption selects usable lots by earliest expiry, then receipt date. Expired stock, stock received after the action date, or insufficient stock cannot be consumed. Records, stock and cost all roll back if an action fails.
- Milk recorded during a known withdrawal interval must be discarded. Discarded milk remains in production totals and is excluded from saleable stock.
- A milk sale cannot exceed recorded saleable production plus explained opening stock, less prior sales and other uses. Corrections require a reason and appear in the audit trail.
- Existing generic inventory balances are flagged when not yet assigned to traceable lots. Reconcile them before using them for care tasks.

## Offline entry

Bulk milk entries, animal-care events and task completion have an IndexedDB outbox. Each request is stored before transmission and retains its idempotency key across a lost response. Queues are separated by signed-in user and farm. Sync checks the server session before sending; stock, permission and revision conflicts remain visible for review or explicit discard.

The production service worker caches the app shell and fetched assets, never authenticated API responses. Selected operational views are held in tab-scoped session storage; financial API responses are excluded. Open the needed screens online first. Other workflows, first-time sign-in, exports and access to uncached records still require a connection. A shared device should be signed out between users.

## Local verification

Use Node.js 22.12 or newer:

```text
npm ci
npm run check
npm test
npm run build
npm run demo
```

`npm run demo` refuses to run when `DATABASE_URL` is set. It uses an in-memory PostgreSQL-compatible PGlite database, binds only to localhost:5179, and prints a randomly generated demo login. Restarting discards the synthetic demo data.

See [VERIFICATION.md](VERIFICATION.md) for executed checks and boundaries.

## Deployment and farm setup

1. Use the configured production PostgreSQL version's tools to create a backup. `npm run backup` creates a custom-format dump and checksum manifest. Test restoration to a separate empty database with `RESTORE_DATABASE_URL` and `npm run backup:restore-check -- path/to/backup.dump`. The command rejects the production target and a nonempty target.
2. Run `npm run db:migrate` with the production environment configured. A new database receives the baseline; an existing installation receives the additive upgrade. Do not use `db:push` for this rollout. The VPS workflow retains its schema-review switch and pre-migration backup, and now waits for type checks, tests and a production build.
3. Set a strong `SESSION_SECRET`, the correct `DATABASE_URL`, `PUBLIC_APP_URL`, and HTTPS session-cookie settings. Keep the existing authentication, storage and WhatsApp configuration. Node 22.12+ is required by the updated dependencies.
4. Restart the application, sign in, and review Data review. Confirm milk-production status for legacy pregnant animals rather than inferring it from pregnancy. Resolve duplicate identities with the preview workflow.
5. Reconcile existing medicine/feed balances into actual lots, including batch, expiry and base unit. Enter the farm's reviewed protocols and diets; approve them with the veterinarian/nutritionist reference. The app does not install universal drug doses, vaccine ages or ration recipes.
6. Select the daily cutoff and approved recipients. Check the first live report against the farm ledger and verify gateway delivery using the deployment's configured WhatsApp session.

Core transactions are serialized per farm to protect stock and retries across app processes. Large-herd performance, actual gateway delivery, hosting configuration and production disaster recovery require verification in that environment. A WhatsApp message left in `processing` after a process crash should be reviewed against the gateway before retrying, because delivery may have occurred before the acknowledgement was saved.
