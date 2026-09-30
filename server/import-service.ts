import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, transactionContext } from "./db";
import * as s from "@shared/schema";
import { daySchema, positive, nonnegative, farmDay } from "@shared/care";
import {
  rows,
  fail,
  recordEvent,
  assertCapacity,
  assertTag,
} from "./care-service";
import { readWorkbook } from "./workbook";
import { validateFarmRequest } from "./request-safety";
import { storage } from "./storage";
export async function importFile(req: any, module: string) {
  if (!req.file) fail("Choose a CSV or XLSX file");
  const input = await readWorkbook(req.file.buffer, req.file.originalname);
  if (!input.length) fail("The file has no data rows");
  const tenant = req.tenantId;
  const token = crypto
    .createHmac("sha256", process.env.SESSION_SECRET!)
    .update(tenant + req.user.id + module)
    .update(req.file.buffer)
    .digest("hex");
  const animals = (await rows(s.cattle, tenant)).filter((c) => !c.mergedIntoId);
  const breeds = await db.select().from(s.breeds);
  const expenseHeads = await db.select().from(s.expenseHeads),
    incomeHeads = await db.select().from(s.incomeHeads);
  const plans: any[] = [],
    errors: any[] = [];
  const tags = new Set<string>(),
    milkKeys = new Set<string>();
  for (const [index, row] of input.entries())
    try {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k
            .toLowerCase()
            .replace(/\([^)]*\)/g, "")
            .replace(/[^a-z0-9]/g, ""),
          String(v).trim(),
        ]),
      );
      const get = (...names: string[]) =>
        names.map((n) => normalized[n]).find(Boolean) || "";
      const date = daySchema.parse(
        get(module === "cattle" ? "dateofentry" : "date", "entrydate"),
      );
      if (module === "cattle") {
        const tag = get("tagnumber", "tag");
        if (!tag) fail("Tag is required");
        if (
          tags.has(tag.toLowerCase()) ||
          animals.some(
            (a) => a.tagNumber.toLowerCase().trim() === tag.toLowerCase(),
          )
        )
          fail("Duplicate animal tag");
        tags.add(tag.toLowerCase());
        const breedName = get("breed", "breedname");
        const breed = breeds.find(
          (b) => b.name.toLowerCase() === breedName.toLowerCase(),
        );
        if (breedName && !breed) fail("Unknown breed");
        const gender = get("gender") || "female",
          stage = get("stage") || "heifer";
        if (!["male", "female"].includes(gender)) fail("Invalid sex");
        if (!["calf", "heifer", "milking", "dry", "pregnant"].includes(stage))
          fail("Invalid stage");
        plans.push({
          tagNumber: tag,
          name: get("name") || null,
          gender,
          stage,
          breedId: breed?.id || null,
          dateOfEntry: date,
          dateOfBirth: get("dateofbirth", "dob")
            ? daySchema.parse(get("dateofbirth", "dob"))
            : null,
          source: get("source") || "purchased",
          status: get("status") || "active",
          notes: get("notes"),
          lifeStage: ["calf", "heifer"].includes(stage) ? stage : "adult",
          productionStatus:
            stage === "pregnant"
              ? null
              : stage === "milking"
                ? "lactating"
                : stage === "dry"
                  ? "dry"
                  : "not_lactating",
          reproductiveStatus: stage === "pregnant" ? "pregnant" : "unserved",
        });
      } else if (module === "milk" || module === "health") {
        const matches = animals.filter(
          (a) =>
            a.tagNumber.toLowerCase().trim() ===
            get(
              "tagnumber",
              "tag",
              "cattletag",
              "cattletagnumber",
            ).toLowerCase(),
        );
        if (matches.length !== 1)
          fail(
            matches.length
              ? "Ambiguous duplicate animal tag"
              : "Animal tag not found",
          );
        const cattleId = matches[0].id;
        if (module === "milk") {
          const entry = {
            date,
            cattleId,
            session: get("session").toLowerCase(),
            destination: get("destination") || "bulk",
            quantity: String(
              nonnegative.parse(
                get("quantity", "quantityl", "quantityliters", "qty"),
              ),
            ),
            fat: get("fat", "fatpercentage") || null,
            snf: get("snf", "snfpercentage") || null,
            notes: get("notes"),
          };
          const key = `${cattleId}:${date}:${entry.session}`;
          if (milkKeys.has(key)) fail("Duplicate milk session in file");
          milkKeys.add(key);
          await validateFarmRequest({
            ...req,
            path: "/api/milk",
            method: "POST",
            body: entry,
          });
          plans.push(entry);
        } else
          plans.push({
            date,
            cattleId,
            eventType: get("eventtype", "type") || "checkup",
            severity: get("severity") || "moderate",
            description: get("description"),
            diagnosis: get("diagnosis"),
            symptoms: get("symptoms"),
            status: get("status") || "active",
            notes: get("notes"),
          });
      } else {
        const heads = module === "expenses" ? expenseHeads : incomeHeads;
        const category = get(
          "expensehead",
          "incomehead",
          "head",
          "category",
          "categoryname",
        );
        const head = heads.find(
          (h) =>
            h.name.toLowerCase() === category.toLowerCase() ||
            h.code.toLowerCase() === category.toLowerCase(),
        );
        if (!head) fail("Unknown accounting head");
        plans.push({
          date,
          headId: head.id,
          amount: String(positive.parse(get("amount", "amountinr"))),
          description: get("description"),
          notes: get("notes"),
          paymentMethod: get("paymentmethod") || "cash",
        });
      }
    } catch (e: any) {
      errors.push({ row: index + 2, message: e.message });
    }
  if (module === "cattle")
    try {
      await assertCapacity(tenant, plans.length);
    } catch (e: any) {
      errors.push({ row: 0, message: e.message });
    }
  if (req.query.commit !== token)
    return {
      preview: true,
      token,
      imported: 0,
      wouldImport: plans.length,
      failed: errors.length,
      total: input.length,
      errors,
      rows: plans,
    };
  if (errors.length)
    fail("Fix every preview error before importing; no records were saved");
  return db.transaction((tx) =>
    transactionContext.run(tx, async () => {
      await db.execute(sql`select pg_advisory_xact_lock(hashtext(${tenant}))`);
      const key = `import:${token}`;
      if ((await rows(s.operationReceipts, tenant)).some((r) => r.key === key))
        fail("This file was already imported", 409);
      for (const plan of plans) {
        let saved: any;
        if (module === "cattle")
          saved = await storage.createCattle({ ...plan, tenantId: tenant });
        else if (module === "milk") {
          await validateFarmRequest({
            ...req,
            path: "/api/milk",
            method: "POST",
            body: plan,
          });
          saved = await storage.createMilkEntry({
            ...plan,
            tenantId: tenant,
            recordedBy: req.user.id,
          });
        } else {
          const table =
            module === "health"
              ? s.healthEvents
              : module === "expenses"
                ? s.expenses
                : s.incomes;
          [saved] = await db
            .insert(table)
            .values({ ...plan, tenantId: tenant, recordedBy: req.user.id })
            .returning();
        }
        await recordEvent(
          tenant,
          "imported",
          plan.date || plan.dateOfEntry,
          { module, entry: saved },
          plan.cattleId || (module === "cattle" ? saved.id : null),
          req.user.id,
        );
      }
      const response = {
        preview: false,
        imported: plans.length,
        failed: 0,
        total: plans.length,
        errors: [],
      };
      await db.insert(s.operationReceipts).values({
        tenantId: tenant,
        key,
        requestHash: token,
        response,
        statusCode: 200,
      });
      await db.insert(s.auditLogs).values({
        tenantId: tenant,
        userId: req.user.id,
        action: "import",
        entityType: module,
        newData: { count: plans.length, token },
      });
      return response;
    }),
  );
}
