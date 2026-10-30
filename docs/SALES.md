# Daily sales and customers

Sales and Customer Details are separate menu items. Owners/admins, managers, supervisors and accountants have access by default. Custom role overrides can grant `sales.view` and `sales.manage` in Users & Roles.

## First-time setup

1. Open Sales and click **Set up dairy products**. Milk, Paneer, Curd, Ghee, Butter and Cream are created once per farm. No selling prices are assumed.
2. In **Items & stock**, edit each item's default rate. Add other items and choose their unit if needed. Units are fixed after creation so past stock remains comparable.
3. Add customers from **Customer Details → Add customer**, or directly in Sales. Enter their contact details, default item (Milk), optional usual quantity and negotiated rate, cash/credit terms and usual payment mode. Enable **Show in daily sales grid** for regular customers.
4. Record milk production in Milk Records. Explained opening milk stock can be entered in Daily Report. For paneer, curd and other finished products, record opening stock, purchased stock or a production batch in Items & stock. Record actual milk used for a production batch to deduct that milk as processing use. Purchase expenses are entered separately in Finances.

## Each day

Select the date in **Sales → Daily bulk entry**. Regular customers appear in a table with item, quantity, rate, calculated amount, cash/credit, payment mode, paid-now amount and payment reference. A customer-specific rate applies to their default item; other products use the item's default rate. Rates and quantities can be changed per row.

Cash means the full amount is received, including when the mode is UPI or bank transfer. Credit can be unpaid or partially paid. Use Monthly credit for unpaid monthly accounts; choose the actual receipt mode when recording a part payment. Blank or zero quantities are skipped. The save total includes entered rows hidden by the search filter. Unsaved grid edits remain when switching Sales tabs; changing date or leaving the page clears unsaved entries.

Click **Save daily sales** once to save the batch. An error saves none of its rows. Previously saved daily customers are shown as Saved. Use **Individual entry** for occasional customers, an additional delivery or another product for the same customer/date. Sales register shows saved entries for the selected date.

## Payments and reporting

Use **Payments & credit** to collect a customer's payment, with date, amount, mode and reference. Receipts clear the oldest eligible unpaid sales first. Overpayment and receipts before the sale date are rejected. Customer Details shows balances and a customer ledger with sales and receipts, including inactive customers.

Each sale creates one income entry for its full value, including credit sales. Receipts reduce the outstanding amount and do not create another income. Milk sales also update the existing milk-sales ledger, milk dashboard totals and animal revenue allocation. Non-milk sales deduct finished-product stock. Daily Report and its PDF/Excel exports include sales, receipts, customer balances, product stock and stock movements. Reports for earlier dates exclude later payments; archived revisions retain their original snapshot. Existing manually entered income is not converted or matched automatically; do not re-enter those historical sales without reconciling the old income.

Milk availability uses that day's saleable production and explained opening stock, less sales and other uses. It excludes discarded milk. Milk does not automatically carry over to the following day. Other product stock carries forward by dated movements; backdated sales cannot make a later balance negative. Stock is tracked by item and date; finished-product expiry/lot allocation and sale returns/corrections are not part of this module.

## Deployment and verification

Back up the target database, deploy the code, run `npm run db:migrate`, and restart the server. The migration runner applies `0001_nebulous_wither.sql` after the existing baseline/upgrade. It is additive and repeatable and preserves old data. This change does not deploy or migrate a live farm automatically.

`npm run check`, `npm test`, and `npm run build` validate the implementation. The sales integration tests cover mixed-product batches, rollback, retry deduplication, duplicate daily entries, tenant/role controls, credit collections, historic balances, stock processing, backdated stock checks, exact totals, exports and repeatable migrations. The isolated demo (`npm run demo`) uses synthetic data and discards it when stopped.
