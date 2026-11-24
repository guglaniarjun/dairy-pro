import type { Express, RequestHandler } from "express";
import { farmDay } from "@shared/care";
import { settings } from "./care-service";
import {
  setupSales,
  saveCustomer,
  saveProduct,
  saveSales,
  correctSale,
  receiveProduct,
  collectPayment,
  salesOverview,
  customerLedger,
  customerActivitiesOverview,
  customerActivityPeople,
  saveCustomerActivity,
  closeCustomerActivity,
} from "./sales-service";
export function registerSales(
  app: Express,
  auth: RequestHandler,
  tenant: RequestHandler,
) {
  const wrap =
    (fn: (r: any) => Promise<any>): RequestHandler =>
    async (req, res) => {
      try {
        res.status(req.method === "POST" ? 201 : 200).json(await fn(req));
      } catch (e: any) {
        res.status(e.status || (e.name === "ZodError" ? 400 : 500)).json({
          error:
            e.name === "ZodError"
              ? e.issues
                  .map((i: any) => `${i.path.join(".")}: ${i.message}`)
                  .join("; ")
              : e.status
                ? e.message
                : "Unable to save sales data",
        });
        if (!e.status && e.name !== "ZodError") console.error(e);
      }
    };
  app.get(
    "/api/sales/customer-activities",
    auth,
    tenant,
    wrap(async (r) => {
      const timezone = (await settings(r.tenantId)).timezone;
      const date = r.query.date || farmDay(timezone);
      return {
        date,
        timezone,
        activities: await customerActivitiesOverview(
          r.tenantId,
          date,
          r.query.customerId,
          r.query.history === "all",
        ),
        people: await customerActivityPeople(r.tenantId),
      };
    }),
  );
  app.post(
    "/api/sales/customer-activities",
    auth,
    tenant,
    wrap((r) => saveCustomerActivity(r.tenantId, r.user.id, r.body)),
  );
  app.patch(
    "/api/sales/customer-activities/:id",
    auth,
    tenant,
    wrap((r) =>
      saveCustomerActivity(r.tenantId, r.user.id, r.body, r.params.id),
    ),
  );
  app.post(
    "/api/sales/customer-activities/:id/complete",
    auth,
    tenant,
    wrap((r) =>
      closeCustomerActivity(r.tenantId, r.user.id, r.params.id, r.body),
    ),
  );
  app.post(
    "/api/sales/customer-activities/:id/cancel",
    auth,
    tenant,
    wrap((r) =>
      closeCustomerActivity(r.tenantId, r.user.id, r.params.id, r.body, true),
    ),
  );
  // Preserve the cancelled row and its reason rather than erasing customer history.
  app.delete(
    "/api/sales/customer-activities/:id",
    auth,
    tenant,
    wrap((r) =>
      closeCustomerActivity(r.tenantId, r.user.id, r.params.id, r.body, true),
    ),
  );
  app.get(
    "/api/sales",
    auth,
    tenant,
    wrap(async (r) =>
      salesOverview(
        r.tenantId,
        r.query.date || farmDay((await settings(r.tenantId)).timezone),
      ),
    ),
  );
  app.get(
    "/api/sales/customers/:id",
    auth,
    tenant,
    wrap((r) => customerLedger(r.tenantId, r.params.id)),
  );
  app.post(
    "/api/sales/setup",
    auth,
    tenant,
    wrap((r) => setupSales(r.tenantId)),
  );
  app.post(
    "/api/sales/customers",
    auth,
    tenant,
    wrap((r) => saveCustomer(r.tenantId, r.body)),
  );
  app.patch(
    "/api/sales/customers/:id",
    auth,
    tenant,
    wrap((r) => saveCustomer(r.tenantId, r.body, r.params.id)),
  );
  app.post(
    "/api/sales/products",
    auth,
    tenant,
    wrap((r) => saveProduct(r.tenantId, r.body)),
  );
  app.patch(
    "/api/sales/products/:id",
    auth,
    tenant,
    wrap((r) => saveProduct(r.tenantId, r.body, r.params.id)),
  );
  app.post(
    "/api/sales/entries",
    auth,
    tenant,
    wrap((r) => saveSales(r.tenantId, r.user.id, r.body)),
  );
  app.patch(
    "/api/sales/entries/:id",
    auth,
    tenant,
    wrap((r) => correctSale(r.tenantId, r.user.id, r.params.id, r.body)),
  );
  app.post(
    "/api/sales/stock",
    auth,
    tenant,
    wrap((r) => receiveProduct(r.tenantId, r.user.id, r.body)),
  );
  app.post(
    "/api/sales/payments",
    auth,
    tenant,
    wrap((r) => collectPayment(r.tenantId, r.user.id, r.body)),
  );
}
