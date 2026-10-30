import type { Express, RequestHandler } from "express";
import { farmDay } from "@shared/care";
import { settings } from "./care-service";
import {
  setupSales,
  saveCustomer,
  saveProduct,
  saveSales,
  receiveProduct,
  collectPayment,
  salesOverview,
  customerLedger,
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
        res
          .status(e.status || (e.name === "ZodError" ? 400 : 500))
          .json({
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
