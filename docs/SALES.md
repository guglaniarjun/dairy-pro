# Daily sales and customers

Sales and Customer Details are separate menu items. Owners/admins, managers, supervisors and accountants have access by default. Custom role overrides can grant `sales.view` and `sales.manage` in Users & Roles.

## First-time setup

1. Open Sales and click **Set up dairy products**. Milk, Paneer, Curd, Ghee, Butter and Cream are created once per farm. No selling prices are assumed.
2. In **Items & stock**, edit each item's default rate. Add other items and choose their unit if needed. Units are fixed after creation so past stock remains comparable.
3. Add customers from **Customer Details → Add customer**, or directly in Sales. Enter their contact details, default item (Milk), optional usual quantity and negotiated rate, payment due terms and usual payment mode. Enable **Show in daily sales grid** for regular customers.
4. Record milk production in Milk Records. Explained opening milk stock can be entered in Daily Report. For paneer, curd and other finished products, record opening stock, purchased stock or a production batch in Items & stock. Record actual milk used for a production batch to deduct that milk as processing use. Purchase expenses are entered separately in Finances.

## Each day

Select the date in **Sales → Daily bulk entry**. Regular customers appear in a table with item, quantity, rate, calculated amount, current account balance, advance applied, payment mode, received-now amount, projected balance and payment reference. A customer-specific rate applies to their default item; other products use the item's default rate. Rates and quantities can be changed per row.

Each customer has one running account. Advance is shown in green, dues in red, and zero as Settled. Available advance is used first. For the rest, choose Cash, UPI, Cheque, Account transfer or Other and enter the actual amount received; selecting a receipt mode initially fills the uncovered sale amount. Choose Credit / Pay later when no money is received. Partial and excess receipts are allowed. When the customer already owes money, receipts settle the oldest unpaid sales first. The projected balance includes both existing dues/advance and the new sale/payment. Blank or zero quantities are skipped. The save total includes entered rows hidden by the search filter. Unsaved grid edits remain when switching Sales tabs; changing date or leaving the page clears unsaved entries.

Click **Save daily sales** once to save the batch. An error saves none of its rows. Previously saved daily customers are shown as Saved. Use **Individual entry** for occasional customers, an additional delivery or another product for the same customer/date. Sales register shows saved entries for the selected date.

## Payments and reporting

Use **Receive payment** to select any customer, receipt date, amount, actual payment mode and optional reference. This also accepts advances before the first purchase and payments from inactive customers. One receipt is saved for the full amount, clears oldest unpaid sales first, and retains any remainder as advance. Consuming advance never creates another receipt. **Customer Details → customer name** opens a chronological ledger with each sale, receipt, payment mode/reference, advance used and running balance. Sales settlement details show each sale's outstanding amount and due date.

Customer payment terms are immediate, after 7 days, after 10 days, end of calendar month, or a custom 1–365 days after each sale. Terms set due dates and overdue labels; they never assume payment. Each sale keeps its original due date when customer defaults are changed. Backdated entries recalculate chronological allocation. Historical screens exclude later receipts and future sales; current accounts include all posted activity. A stale balance blocks saving a sales draft until it is refreshed and reviewed.

Example: three paid ₹100 sales leave zero; the next three unpaid ₹100 sales leave ₹300 due. Receiving ₹500 clears this and leaves ₹200 advance. Two later ₹100 sales consume it, without generating additional receipt or income records.

Each sale creates one income entry for its full value, including credit sales. Receipts reduce dues or increase advance and do not create another income. Milk sales also update the existing milk-sales ledger, milk dashboard totals and animal revenue allocation. Non-milk sales deduct finished-product stock. Daily Report and its PDF/Excel exports include sales, receipts, customer balances, product stock and stock movements. Reports for earlier dates exclude later payments; archived revisions retain their original snapshot. Existing manually entered income is not converted or matched automatically; do not re-enter those historical sales without reconciling the old income.

Milk availability uses that day's saleable production and explained opening stock, less sales and other uses. It excludes discarded milk. Milk does not automatically carry over to the following day. Other product stock carries forward by dated movements; backdated sales cannot make a later balance negative. Stock is tracked by item and date; finished-product expiry/lot allocation and sale returns/corrections are not part of this module.

## Deployment and verification

Back up the target database, deploy the code, run `npm run db:migrate`, and restart the server. The migration runner applies `0001_nebulous_wither.sql` and `0002_peaceful_venom.sql` after the existing baseline/upgrade. The account migration retains all prior sale/receipt amounts and references, adds receipt totals and due dates, and permits receipts without a linked sale. It is additive and repeatable and preserves old data. Preserve the VPS owner-login overlay during deployment, as recorded in VERIFICATION.md.

`npm run check`, `npm test`, and `npm run build` validate the implementation. The sales integration tests cover mixed-product batches, rollback, retry deduplication, duplicate daily entries, tenant/role controls, credit collections, historic balances, stock processing, backdated stock checks, exact totals, exports and repeatable migrations. The isolated demo (`npm run demo`) uses synthetic data and discards it when stopped.
