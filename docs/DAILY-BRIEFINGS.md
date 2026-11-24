# Morning and evening print reports

Open **Daily farm report**, choose **Morning** or **Evening**, and select the date the report is to be read. Use **Open print layout** or **Download PDF**. Print on A4 portrait at actual size.

| Report read on | Farm figures covered | Work shown |
| --- | --- | --- |
| Morning, 22 November | 21 November, including both morning and evening milk | Open and overdue work for 22 November, plus the next 30 days |
| Evening, 22 November | 22 November, including all milk entered so far | Open and overdue work for 22 November, plus the next 30 days |

The morning report also includes a separate update of today's morning milk and medicines, when these have already been entered. They are not added to yesterday's totals. The evening report marks missing sessions rather than assuming they produced zero milk. Choose an evening report time after the farm normally finishes entering evening milk.

## The printed pages

**Page 1: farm overview and milk by animal.** Milk produced, milk sold, dairy sales and money collected are followed by herd counts, urgent-work and milk-sale warnings. Dairy sales include other dairy products, when entered, as well as milk. The full cattle table shows each recorded session, the total, the usual evening yield and any unusual reduction or missing record. The milk check compares opening stock, production, sales, discarded milk and recorded uses or closing stock.

**Page 2: care, work and customers.** Open farm work includes the animal, instructions, person responsible, due date/time and urgent or overdue status. Actual medicine records include the medicine, amount, route, when/by whom it was given and recorded milk-sale restriction. Customer activities and accounts follow, then recorded expenses and stock warnings.

The report has two main pages. If there are more animals, instructions or customer rows than can be printed legibly, it adds clearly labelled continuation pages with repeated headings. It never silently drops records to force two sheets.

## Milk comparison settings

In **Settings → Milking**, configure the percentage reduction, minimum reduction in litres, number of earlier calendar days and minimum number of recorded days. Defaults are **20%, 1 litre, 7 earlier days, at least 5 recorded days**.

Each animal is compared with its own earlier measurements for the same session. Both the percentage and litre thresholds must be reached before the report marks a reduction. The covered day and later days are excluded from that baseline. Recorded zero quantities are included; missing measurements are not. Where there is insufficient history, the report says so rather than estimating a usual yield.

These settings control the print-report comparison. Existing smart-alert rules continue to use their own conditions.

## Medicines and urgent work

Record medicine administration through **Care & Work**. Treatment, vaccination and deworming forms accept optional medicine name, amount, route, actual time in the farm timezone and the person who gave it. Single and batch task completion also accept these actual administration details. Record the approved instructions and any milk-sale restriction through the existing care workflow.

A planned task or an illness description is not counted as medicine given. The person who entered or completed a record is not assumed to be the person who gave the medicine. Missing details are labelled as not recorded; an empty medicine section does not certify that no medicines were given.

Set a task's priority to **Urgent** when it must be explicitly called out. Open tasks retain their due dates and overdue labels. Current milk-sale restrictions are shown separately from the covered day's administrations.

## Customer activities and accounts

In **Sales → Customers**, select a customer and use **Customer activities** to add a delivery change, payment collection or follow-up. Enter the instructions, due date/time, priority and person responsible. Activities can be edited, completed or cancelled; closed items retain their history and completion/cancellation note.

Unpaid bills also create read-only collection reminders. Their balances are calculated from recorded sales and receipts. Record a receipt through the existing payment workflow to settle a bill. Completing a manual activity does not record a payment or change a delivery.

In the printed customer account table:

- **Billed** and **Received** refer to the covered date.
- **Still owes** includes older unpaid bills through that date.
- **Advance** is customer money held for future bills, shown separately from money owed.

Customer activity reminders use the work date. For example, a morning report can show yesterday's closing account balance alongside a collection reminder recalculated for today. A later payment can therefore change today's reminder without changing yesterday's saved account balance.

## Scheduling and saved reports

Users with settings permission can choose **Morning and evening briefings** in the report schedule, set both farm-local times and save the schedule as active. Default times are 07:30 and 19:30. Each period has its own saved revisions and scheduling cursor. Existing single-cutoff schedules retain their original behavior until explicitly changed.

The worker saves each briefing after its cutoff. Configured recipients receive the existing report-link notification; an empty recipient list still allows automatic report creation. No recipient or outbound delivery is enabled by this code change alone. Missing scheduled dates are recovered after downtime, with the actual preparation time shown.

Saved reports retain their original snapshot. Rebuilding a preview uses the records and open-work state available when it is generated, including later corrections; it does not reconstruct a historical morning state. Save a new revision when a corrected report should replace the current version. The selected delivery date, period and archive must match.

## Release steps

Back up the database, apply the additive migrations with `npm run db:migrate`, then deploy the application build using the existing deployment procedure. The new migrations are `0003_morning_evening_reports.sql` and `0004_customer_activities.sql`. Preserve the production owner-login integration described in `VERIFICATION.md`.

The migrations add period-specific archives/schedule fields, milk comparison settings and customer activities. They retain existing daily archives, account records and legacy schedules. No existing schedule is automatically switched to two briefings.

Relevant checks: `npm run check`, `npm test`, `npm run build`. The briefing tests cover two-page normal output, readable overflow, missing measurements, earlier-session baselines, actual medicine evidence, customer permissions and balances, period-specific archives and scheduler recovery.

## Local verification, 22 November 2026

- All **104 automated tests** passed, with no failed, skipped or cancelled tests. TypeScript checking and the production client/server build passed.
- Rendered and visually checked both pages of the morning and evening PDFs generated by the application renderer. The 19-animal sample fits two pages; the larger 95-animal/long-instruction test verifies readable continuation pages.
- Tested the report selector, correct covered dates and both PDF downloads in headless Edge against an isolated demo. Customer activity creation, editing, owner/time/priority selection, completion and cancellation passed without JavaScript page errors.
- Customer links were checked against the actual `/customers` route. Closed activities show their original due date rather than an active overdue warning.
- The build still reports its existing PostCSS and client bundle-size warnings; it completes successfully.
- Production deployment, production database migration and real outbound messaging were not performed for this release.
