# DairyFlow — Multi-Tenant Dairy Farm ERP

**DairyFlow** is a production-ready, multi-tenant SaaS ERP system built for Indian dairy farms. It covers every aspect of farm operations — cattle management, milk production, breeding, health, feed, inventory, finances, and smart alerts — all in one place.

- **Currency**: ₹ INR
- **Language**: English (India)
- **Target Herd Size**: 1 – 500 cattle
- **Platform**: Web (PWA, mobile-responsive)

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Authentication & Multi-Tenancy](#authentication--multi-tenancy)
7. [Subscription Plans](#subscription-plans)
8. [Smart Alerts Engine](#smart-alerts-engine)
9. [Drill-Down Navigation](#drill-down-navigation)
10. [Environment Variables](#environment-variables)
11. [Getting Started (Development)](#getting-started-development)
12. [Available Scripts](#available-scripts)
13. [Deployment](#deployment)

---

## Features

### Core Modules

| Module | Description |
|---|---|
| **Dashboard** | Live KPIs: herd summary, today's milk, finance P&L, breeding actions due, active alerts |
| **Cattle Management** | Full animal registry with tag numbers, breed, age, stage (milking/pregnant/dry/heifer/calf/bull), individual profiles |
| **Milk Production** | 3x/day session recording (morning/afternoon/evening), fat & SNF %, bulk milk sales, trend charts |
| **Breeding** | Heat detection, AI/natural service, pregnancy testing, calving records, conception rate analytics |
| **Health** | Illness/treatment records, vaccination scheduling, deworming, drug withdrawal tracking |
| **Feed Management** | Daily feeding logs per animal, feed inventory (stock levels), ration formulation |
| **Inventory** | General farm supplies (medicine, equipment), stock in/out movements, low-stock alerts |
| **Finances** | Income & expense tracking by category head, monthly P&L, cost per kg milk |
| **Byproducts** | Cow dung, biogas slurry, vermicompost sale transactions |
| **Cattle Transactions** | Purchase and sale records with profit/loss per animal |
| **Tasks** | Farm task scheduling with priority, due date, type, and completion tracking |
| **Alerts** | Auto-generated smart alerts for heat due, pregnancy test due, vaccination due, low stock |
| **Reports** | Bar/line charts for milk trends and finance; CSV export for all modules |
| **Import/Export** | Bulk data import via XLSX/CSV with templates, export for all modules |
| **Settings** | 7-tab settings: Farm, Milking, Breeding, Notifications, WhatsApp, Storage, Admin |
| **Billing** | Subscription plan management with cattle usage tracking |

### Advanced Capabilities

- **Full Drill-Down Interactivity** — Every KPI card, badge, and stat button navigates to filtered underlying data via reactive URL params
- **Smart Alerts Engine** — Runs continuously in the server, with customizable event timing, cattle scope, conditions, recipients, and delivery channels
- **Offline-First PWA** — Service worker caching for core data (mobile-friendly)
- **Universal Attachments** — Image, PDF, and audio uploads (max 10 MB) linked to any record; configurable for S3/Supabase
- **WhatsApp Notifications** — One persistent Super Admin WhatsApp Web session, QR pairing, queued delivery, retries, tests, and tenant-owner broadcasts
- **Cattle P&L Dashboard** — Per-animal profitability: purchase cost, feed costs, vet costs, milk revenue, sale proceeds
- **Master Data Pre-seeded** — Breeds, vaccines, feed items, expense/income heads, inventory categories ready out of the box

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool & dev server |
| Wouter | Client-side routing |
| TanStack React Query v5 | Server state, caching, mutations |
| shadcn/ui + Radix UI | Accessible component library |
| Tailwind CSS | Utility-first styling (light/dark mode) |
| Recharts | Data charts (milk trends, finance) |
| React Hook Form + Zod | Form handling with schema validation |
| Lucide React | Icon library |
| Framer Motion | Animations |
| date-fns | Date formatting/arithmetic |
| xlsx | Excel import/export |

### Backend

| Technology | Purpose |
|---|---|
| Node.js + Express | HTTP server |
| TypeScript | Type safety |
| Drizzle ORM | Database queries & schema |
| drizzle-zod | Auto-generate Zod schemas from DB schema |
| PostgreSQL | Primary database |
| Passport.js + openid-client | Authentication (Replit OIDC) |
| express-session + connect-pg-simple | Session storage in PostgreSQL |
| Multer | File upload handling |
| AWS S3 SDK | Cloud file storage |
| Nodemailer | Email notifications |
| ws | WebSocket support |
| uuid | ID generation |

---

## Project Structure

```
dairy-pro/
├── client/                         # React frontend
│   └── src/
│       ├── App.tsx                 # Router setup, providers
│       ├── main.tsx                # React entry point
│       ├── pages/
│       │   ├── dashboard.tsx       # Main dashboard with KPIs
│       │   ├── landing.tsx         # Public landing / login page
│       │   ├── cattle/
│       │   │   ├── index.tsx       # Cattle list with filters
│       │   │   ├── detail.tsx      # Individual cattle profile
│       │   │   ├── new.tsx         # Register new animal
│       │   │   └── pl-dashboard.tsx # Per-animal P&L
│       │   ├── milk/
│       │   │   ├── index.tsx       # Milk records & sales
│       │   │   └── new.tsx         # Record milk entry
│       │   ├── breeding/
│       │   │   ├── index.tsx       # Breeding overview
│       │   │   ├── heat.tsx        # Record heat detection
│       │   │   ├── ai.tsx          # Record AI/service
│       │   │   ├── pregnancy-test.tsx
│       │   │   └── calving.tsx
│       │   ├── health/
│       │   │   ├── index.tsx       # Health events + vaccinations
│       │   │   ├── new.tsx         # Record health event
│       │   │   └── vaccination.tsx # Record vaccination
│       │   ├── feed/
│       │   │   ├── index.tsx       # Feeding logs & inventory
│       │   │   ├── new.tsx         # Add feeding record
│       │   │   └── formulation.tsx # Ration calculator
│       │   ├── inventory/
│       │   │   ├── index.tsx       # Stock overview
│       │   │   ├── new.tsx         # Add inventory item
│       │   │   ├── purchase.tsx    # Record stock purchase
│       │   │   └── issue.tsx       # Issue stock
│       │   ├── finances/
│       │   │   ├── index.tsx       # P&L, expenses, incomes
│       │   │   ├── expense-new.tsx
│       │   │   └── income-new.tsx
│       │   ├── byproducts/
│       │   │   └── index.tsx       # Byproduct transactions
│       │   ├── cattle-transactions/
│       │   │   ├── purchase.tsx    # Record cattle purchase
│       │   │   └── sale.tsx        # Record cattle sale
│       │   ├── tasks/
│       │   │   ├── index.tsx       # Task list
│       │   │   └── new.tsx         # Create task
│       │   ├── alerts/
│       │   │   └── index.tsx       # Alerts with filtering
│       │   ├── reports/
│       │   │   └── index.tsx       # Analytics & CSV export
│       │   ├── import-export/
│       │   │   └── index.tsx       # Bulk data import/export
│       │   ├── settings/
│       │   │   └── index.tsx       # 7-tab settings page
│       │   └── billing/
│       │       └── index.tsx       # Plans & subscription
│       ├── components/
│       │   ├── ui/                 # shadcn/ui component library
│       │   ├── app-sidebar.tsx     # Desktop sidebar navigation
│       │   ├── mobile-bottom-nav.tsx # Mobile bottom navigation
│       │   └── attachments/        # File upload components
│       ├── hooks/                  # Custom React hooks
│       └── lib/
│           └── queryClient.ts      # TanStack Query + apiRequest helper
│
├── server/
│   ├── index.ts                    # Express app bootstrap
│   ├── routes.ts                   # All API route definitions
│   ├── storage.ts                  # IStorage interface + DB implementation
│   ├── db.ts                       # Drizzle ORM connection
│   ├── upload.ts                   # Multer file upload config
│   ├── seed.ts                     # Master data seed script
│   └── seed-testfarm.ts            # Demo farm data seed
│
├── shared/
│   ├── schema.ts                   # Drizzle table definitions + Zod schemas
│   └── models/
│       └── auth.ts                 # Auth type definitions
│
├── drizzle.config.ts               # Drizzle migration config
├── tailwind.config.ts              # Tailwind CSS config
├── vite.config.ts                  # Vite build config
├── tsconfig.json                   # TypeScript config
├── package.json                    # Dependencies & scripts
└── replit.md                       # Project overview & preferences
```

---

## Database Schema

All tables use UUID primary keys. Every tenant-scoped table includes a `tenantId` column that references `tenants.id`, ensuring strict data isolation between farms.

### Tenancy & Subscriptions

#### `tenants`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | Tenant identifier |
| name | text | Farm name |
| slug | text | URL-friendly identifier |
| ownerId | text | References `users.id` |
| plan | text | Current plan tier |
| maxCattle | integer | Cattle limit for current plan |
| address, phone | text | Farm contact details |
| language | text | UI language preference |

#### `tenant_members`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| tenantId | uuid FK | |
| userId | text FK | |
| role | text | `owner` / `manager` / `worker` |
| permissions | jsonb | Granular permission flags |

#### `subscription_plans`
Defines available SaaS tiers with cattle limits, user limits, price, and feature flags.

#### `tenant_subscriptions`
Tracks active subscription for each tenant including Stripe subscription ID and billing dates.

---

### Cattle Management

#### `cattle`
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| tenantId | uuid FK | |
| tagNumber | text | Physical ear tag (e.g. GVD-001) |
| name | text | Animal name |
| breedId | uuid FK | References `breeds` |
| gender | text | `female` / `male` |
| dateOfBirth | date | |
| status | text | `active` / `sold` / `dead` |
| stage | text | `milking` / `pregnant` / `dry` / `heifer` / `calf` / `bull` |
| lactationNumber | integer | Current lactation count |
| purchaseDate, purchasePrice | | Acquisition details |
| sireId, damId | uuid FK | Parent references |
| notes | text | |

#### `breeds`
Global (not tenant-scoped) breed catalog with `name`, `code`, `type` (HF/Jersey/Gir/etc), and `avgMilkYield`.

#### `cattle_transactions`
Records cattle purchases and sales with `amount`, `partyName`, `partyPhone`, `paymentStatus`, `profitLoss`, and financial roll-up columns.

#### `cattle_costs`
Allocates operational expenses (feed, vet, labor) to individual animals for per-animal P&L calculation.

---

### Breeding & Reproduction

#### `heats`
| Column | Description |
|---|---|
| cattleId | Animal in heat |
| detectedAt | Timestamp of detection |
| intensity | `mild` / `moderate` / `strong` |
| nextExpectedDate | Calculated next heat date |

#### `inseminations`
Records AI or natural service with `bullId`, `semenBatchId`, `method`, and expected pregnancy test date.

#### `pregnancy_tests`
| Column | Description |
|---|---|
| result | `positive` / `negative` / `inconclusive` |
| method | `rectal` / `ultrasound` / `blood_test` |
| expectedCalvingDate | Calculated from test date |

#### `calvings`
| Column | Description |
|---|---|
| calfId | References the new calf's `cattle` record |
| outcome | `normal` / `assisted` / `caesarean` / `stillbirth` |
| calfGender, calfWeight | |
| lactationNumber | Starts new lactation |

---

### Milk Production

#### `milk_entries`
| Column | Description |
|---|---|
| cattleId | Producing animal |
| date | Recording date |
| session | `morning` / `afternoon` / `evening` |
| quantity | Litres |
| fat, snf | Quality parameters (%) |
| recordedBy | User who recorded |

#### `milk_sales`
| Column | Description |
|---|---|
| date | Sale date |
| quantity | Total litres sold |
| pricePerLitre | ₹ per litre |
| totalAmount | Calculated total |
| buyerName | Dairy/co-op name |
| paymentStatus | `paid` / `pending` |

---

### Health & Treatment

#### `health_events`
| Column | Description |
|---|---|
| cattleId | Affected animal |
| eventType | `illness` / `injury` / `checkup` / `surgery` |
| severity | `mild` / `moderate` / `severe` |
| symptoms | Text description |
| diagnosis | Vet diagnosis |
| status | `active` / `resolved` |
| vetName | Attending vet |

#### `treatments`
Links to `health_events`. Records administered medicines with `dosage`, `route`, `withdrawalDays`, and `cost`.

#### `vaccinations`
| Column | Description |
|---|---|
| cattleId | Vaccinated animal |
| vaccineId | References `vaccines` |
| dateAdministered | |
| nextDueDate | Auto-calculated from frequency |
| administeredBy | Vet or farm worker |

#### `vaccines`
Global catalog with `diseaseTarget`, `frequencyDays`, and `manufacturer`.

---

### Feed & Inventory

#### `feed_inventory`
| Column | Description |
|---|---|
| feedItemId | References `feed_items` |
| quantity | Current stock (kg) |
| unitCost | ₹ per kg |
| expiry | Date |
| minStock | Reorder threshold |

#### `feeding_records`
Daily feeding log per animal per feed item. Tracks `plannedQuantity` vs `actualQuantity`.

#### `inventory_items`
| Column | Description |
|---|---|
| name | Item name |
| categoryId | Feed / Medicine / Equipment |
| unit | kg / litre / piece |
| currentStock | Current quantity |
| minStock | Low-stock threshold |
| avgCost | Average unit cost |

#### `inventory_transactions`
Audit log of all stock movements: `purchase`, `issue`, `wastage`, `adjustment`.

---

### Accounting

#### `expense_heads` / `income_heads`
Pre-seeded category masters (Feed Purchase, Veterinary, Labour, Milk Sales, Manure Sale, etc.).

#### `expenses`
| Column | Description |
|---|---|
| headId | Expense category |
| date | |
| amount | ₹ |
| vendorName | Supplier/payee |
| paymentMethod | `cash` / `bank_transfer` / `upi` |
| referenceType / referenceId | Optional link to a cattle/health record |

#### `incomes`
Same structure as expenses but with `customerName` and `incomeHead`.

---

### System Tables

| Table | Purpose |
|---|---|
| `tasks` | Farm chores with priority, type, due date, recurring pattern |
| `alerts` | Auto-generated notifications (health/breeding/inventory) |
| `farm_settings` | Per-tenant config: currency, timezone, milking sessions, dry-off interval |
| `whatsapp_configs` | WhatsApp Web or API integration settings |
| `whatsapp_logs` | Sent message log with delivery status |
| `notification_rules` | Automated alert triggers (e.g., remind 7 days before calving) |
| `attachments` + `attachment_links` | Polymorphic file upload system |
| `audit_logs` | Change tracking (oldData, newData, action, userId) |
| `system_settings` | Global key-value config store (super-admin) |

---

## API Reference

All endpoints require authentication (session cookie). Tenant context is resolved from the authenticated user's session. All IDs are UUIDs.

**Base URL**: `/api`

---

### Authentication

| Method | Path | Description |
|---|---|---|
| GET | `/auth/user` | Returns current authenticated user |

---

### Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/stats` | Core KPIs: herd counts, today's milk, active alerts, breeding actions |
| GET | `/dashboard/full-stats` | Extended KPIs grouped by Herd, Breeding, Milk, Finance |

---

### Master Data

| Method | Path | Description |
|---|---|---|
| GET | `/breeds` | All cattle breeds |
| GET | `/vaccines` | All vaccines |
| GET | `/feed-items` | All feed item definitions |
| GET | `/expense-heads` | Expense categories |
| GET | `/income-heads` | Income categories |
| GET | `/inventory-categories` | Inventory categories |
| GET | `/byproduct-types` | Byproduct types (manure, biogas, etc.) |

---

### Cattle

| Method | Path | Description |
|---|---|---|
| GET | `/cattle` | List all cattle (supports `?stage=`, `?status=`, `?search=`) |
| POST | `/cattle` | Register new animal |
| GET | `/cattle/:id` | Get single cattle with full profile |
| PATCH | `/cattle/:id` | Update cattle details |
| GET | `/cattle/:id/milk-entries` | Milk history for one animal |
| GET | `/cattle/:id/health-events` | Health history for one animal |
| GET | `/cattle/:id/inseminations` | Breeding history for one animal |
| GET | `/cattle/:id/heats` | Heat history for one animal |
| GET | `/cattle/:id/pregnancy-tests` | Pregnancy test history |
| GET | `/cattle/:id/calvings` | Calving history |
| GET | `/cattle/:id/vaccinations` | Vaccination history |
| GET | `/cattle-transactions` | List all cattle purchase/sale records |
| POST | `/cattle-transactions` | Record cattle purchase or sale |
| GET | `/cattle-transactions/:id` | Single transaction detail |
| GET | `/cattle-transactions/:id/payments` | Payments for a transaction |

---

### Milk

| Method | Path | Description |
|---|---|---|
| GET | `/milk` | List milk entries (supports `?cattleId=`, `?from=`, `?to=`) |
| POST | `/milk` | Record milk entry |
| GET | `/milk-sales` | List milk sale records |
| POST | `/milk-sales` | Record milk sale |

---

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | List health events (supports `?cattleId=`, `?status=`) |
| POST | `/health` | Create health event |
| PATCH | `/health/:id` | Update health event (e.g., mark resolved) |
| GET | `/vaccinations` | List vaccination records |
| POST | `/vaccinations` | Record vaccination |
| GET | `/vaccinations/due` | Animals due for vaccination within 14 days |

---

### Breeding

| Method | Path | Description |
|---|---|---|
| GET | `/breeding/heats` | List heat records |
| POST | `/breeding/heats` | Record heat detection |
| GET | `/breeding/inseminations` | List inseminations |
| POST | `/breeding/inseminations` | Record AI or natural service |
| GET | `/breeding/pregnancy-tests` | List pregnancy tests |
| POST | `/breeding/pregnancy-tests` | Record pregnancy test |
| GET | `/breeding/calvings` | List calving records |
| POST | `/breeding/calvings` | Record calving |
| GET | `/breeding/analytics` | Conception rate, inter-calving interval, etc. |

---

### Finances

| Method | Path | Description |
|---|---|---|
| GET | `/expenses` | List expenses (supports `?from=`, `?to=`, `?headId=`) |
| POST | `/expenses` | Record expense |
| GET | `/incomes` | List incomes |
| POST | `/incomes` | Record income |
| GET | `/finance/analytics` | Monthly P&L, cost per litre, category breakdown |

---

### Feed

| Method | Path | Description |
|---|---|---|
| GET | `/feed/inventory` | Current feed stock levels |
| GET | `/feed/records` | Feeding logs (supports `?cattleId=`) |
| POST | `/feed/records` | Record feeding session |

---

### Inventory

| Method | Path | Description |
|---|---|---|
| GET | `/inventory` | List inventory items (supports `?tab=low-stock\|feed\|medicine\|equipment`) |
| POST | `/inventory` | Create inventory item |
| GET | `/inventory/transactions` | Stock movement log |
| POST | `/inventory/transactions` | Record stock movement |

---

### Tasks & Alerts

| Method | Path | Description |
|---|---|---|
| GET | `/tasks` | List tasks (supports `?status=`, `?priority=`) |
| POST | `/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task (complete, reassign, etc.) |
| GET | `/alerts` | List alerts |
| GET | `/alerts/active` | Active unread alerts (used for sidebar badge) |
| PATCH | `/alerts/:id` | Dismiss or update alert |

---

### Byproducts

| Method | Path | Description |
|---|---|---|
| GET | `/byproducts` | List byproduct transactions |
| POST | `/byproducts` | Record byproduct sale/use |

---

### Settings

| Method | Path | Description |
|---|---|---|
| GET | `/settings` | Get tenant settings |
| PUT | `/settings` | Update tenant settings |
| GET | `/farm-settings` | Get farm configuration (milking sessions, dry-off, etc.) |
| PUT | `/farm-settings` | Update farm configuration |
| GET | `/whatsapp/config` | Get WhatsApp settings |
| PUT | `/whatsapp/config` | Update WhatsApp settings |
| POST | `/whatsapp/test` | Send test WhatsApp message |
| GET | `/whatsapp/logs` | WhatsApp message history |
| GET | `/notification-rules` | List notification trigger rules |
| PUT | `/notification-rules/:ruleType` | Update notification rule |

---

### Billing

| Method | Path | Description |
|---|---|---|
| GET | `/subscription-plans` | List all available plans |
| GET | `/billing/subscription` | Current subscription and cattle usage |

---

### Import / Export

| Method | Path | Description |
|---|---|---|
| GET | `/export/:module` | Export module data as CSV/XLSX. Modules: `cattle`, `milk`, `health`, `breeding`, `feeding`, `expenses`, `incomes` |
| GET | `/import/template/:module` | Download import template |
| POST | `/import/:module` | Upload XLSX/CSV for bulk import |

---

### Storage & Admin

| Method | Path | Description |
|---|---|---|
| GET | `/storage/status` | Storage usage and provider info |
| GET | `/admin/storage-config` | Check if S3/Supabase is configured |
| GET | `/admin/system-settings` | Global system settings (super-admin only) |
| POST | `/admin/system-settings` | Update global settings |

---

## Authentication & Multi-Tenancy

### Authentication Flow

DairyFlow uses **Replit Auth** (OpenID Connect) for authentication:

1. User clicks "Login" → redirects to Replit OIDC provider
2. On successful callback, user record is created/updated in the `users` table
3. If the user has no tenant, a new tenant is automatically created for them (Free plan, 2 cattle max)
4. Session is stored in the `sessions` table in PostgreSQL

### Multi-Tenancy Model

Every API request goes through this middleware chain:

```
Request → Session Auth → Resolve User → Resolve Tenant → Route Handler
```

- **Tenant isolation** is enforced at the storage layer — every query filters by `tenantId`
- **Roles**: `owner`, `manager`, `worker` (stored in `tenant_members`)
- **Plan enforcement**: Cattle count checked against `tenant.maxCattle` on every new cattle registration

### Session Storage

Sessions are stored in PostgreSQL using `connect-pg-simple`. Session secret is provided via the `SESSION_SECRET` environment variable.

---

## Subscription Plans

| Plan | Max Cattle | Price/month |
|---|---|---|
| Free | 2 | ₹0 |
| Starter | 25 | ₹499 |
| Basic | 75 | ₹999 |
| Pro | 200 | ₹1,999 |
| Enterprise | 500 | ₹3,999 |

Plan upgrades are managed via the `/billing` page. Stripe integration is pre-wired for payment processing.

---

## Smart Alerts Engine

The alerts engine runs in the server every five minutes by default. Dashboard loads can also trigger an evaluation, and a farm owner can run rules immediately from Settings → Notifications. Alert creation is idempotent, so repeated evaluations do not duplicate the same occurrence.

Each tenant can create multiple independent rules with day offsets (for example birth day `0`, then days `10`, `20`, and `30`), a specific animal or cattle stage, severity, app and WhatsApp channels, recipient scope, and an optional message template.

| Alert Type | Trigger Condition |
|---|---|
| **Heat Due** | Female cattle expected heat date within the next 3 days |
| **Pregnancy Test Due** | Insemination date + 30 days is within the next 7 days |
| **Vaccination Due** | `nextDueDate` within the next 14 days |
| **Low Inventory** | `currentStock` ≤ `minStock` for any inventory item |
| **Birth Follow-up** | Configured day offsets after a calving record |
| **Death Recorded** | Configured day offsets after cattle is marked dead |
| **Milk Drop** | Latest daily yield drops by the configured percentage versus its lookback average |
| **Cattle Parameter** | A numeric cattle field or age in days matches the configured operator and value |

Generated alerts are stored in the `alerts` table. WhatsApp deliveries are placed in `whatsapp_logs` and processed by a background outbox with retry/backoff. The sidebar navigation badge shows the live unread count by polling `/api/alerts/active`.

### WhatsApp Web session

Only the Super Admin can open Settings → WhatsApp. Click **Connect / show QR**, then scan the QR from WhatsApp → Linked devices on the sending phone. `LocalAuth` stores the browser session under `.whatsapp-auth/`, so that directory must persist across PM2 restarts and deployments. Farm owners enable WhatsApp per alert rule and choose their own farm number or custom recipients; only the Super Admin can select all tenant owners or send a manual broadcast.

This integration automates WhatsApp Web rather than using the official WhatsApp Business API. WhatsApp can log out, change its web client, or restrict accounts that send automated/bulk messages. Use conservative message volume and obtain recipient consent.

---

## Drill-Down Navigation

All stat cards and KPI badges are clickable links that navigate to the relevant module with URL filters pre-applied. This uses Wouter's `useSearch()` hook for reactive URL params — no stale reads via `window.location.search`.

| Source | URL Pattern |
|---|---|
| Dashboard → Milking cows | `/cattle?stage=milking` |
| Dashboard → Pregnant cows | `/cattle?stage=pregnant` |
| Dashboard → Heat due | `/breeding?filter=heat-due` |
| Dashboard → Pregnancy test due | `/breeding?filter=pt-due` |
| Dashboard → Vaccination due | `/health?tab=vaccination&status=active` |
| Dashboard → Active health issues | `/health?status=active` |
| Dashboard → Low stock | `/inventory?tab=low-stock` |
| Finance tab navigation | `/finances?tab=income\|expenses\|analysis` |
| Inventory tab navigation | `/inventory?tab=all\|low-stock\|feed\|medicine\|equipment` |
| Feed filtered by animal | `/feed?cattleId=<id>` |
| Milk filtered by animal | `/milk?cattleId=<id>` |
| Health filtered by animal | `/health?cattleId=<id>` |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Express session encryption secret |
| `GITHUB_TOKEN` | No | GitHub PAT for repo sync |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Auto | PostgreSQL connection parts (auto-set on Replit) |
| `REPL_ID` | Auto | Replit project identifier |
| `REPLIT_DOMAINS` | Auto | Allowed domains for OIDC callback |
| `SUPER_ADMIN_EMAILS` | Yes for admin features | Comma-separated emails allowed to pair WhatsApp and broadcast; defaults to `admin@dairyflow.com` |

### Optional Integrations

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | S3 file storage |
| `AWS_SECRET_ACCESS_KEY` | S3 file storage |
| `AWS_REGION` | S3 bucket region |
| `S3_BUCKET_NAME` | S3 bucket name |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email notifications |
| `STRIPE_SECRET_KEY` | Payment processing |
| `OPENAI_API_KEY` | AI features |
| `WHATSAPP_WEB_ENABLED` | Set to `false` to disable the WhatsApp Web process; enabled by default |
| `WHATSAPP_AUTH_PATH` | Persistent WhatsApp session directory; defaults to `<app>/.whatsapp-auth` |
| `CHROMIUM_EXECUTABLE_PATH` | Optional path to the VPS Chromium/Chrome executable |
| `NOTIFICATION_EVALUATION_INTERVAL_MS` | Rule evaluation interval; defaults to 300000 (5 minutes) |
| `WHATSAPP_DELIVERY_INTERVAL_MS` | WhatsApp outbox interval; defaults to 30000 (30 seconds) |

---

## Getting Started (Development)

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A Replit account (for Replit Auth)

### 1. Clone the repository

```bash
git clone https://github.com/guglaniarjun/dairy-pro.git
cd dairy-pro
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file (or set secrets in your hosting platform):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dairyflow
SESSION_SECRET=your-random-secret-here
```

### 4. Push database schema

```bash
npm run db:push
```

This runs `drizzle-kit push` to create all tables in your PostgreSQL database.

### 5. Seed master data

```bash
npx tsx server/seed.ts
```

This populates the global master tables: breeds, vaccines, feed items, expense heads, income heads, inventory categories, byproduct types.

### 6. Start development server

```bash
npm run dev
```

The app starts on `http://localhost:5000`. Both the Express backend and Vite frontend are served from the same port.

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `NODE_ENV=development tsx server/index.ts` | Start development server (Express + Vite HMR) |
| `build` | `tsx script/build.ts` | Build frontend + bundle backend for production |
| `start` | `NODE_ENV=production node dist/index.cjs` | Start production server |
| `check` | `tsc` | TypeScript type check |
| `db:push` | `drizzle-kit push` | Push schema changes to database |

---

## Deployment

### Replit (Recommended)

The project is pre-configured for Replit deployment:

1. Open the project on Replit
2. Click **Deploy** in the top bar
3. Replit handles TLS, health checks, and auto-restart

The production build serves the compiled frontend as static files from the Express server.

### Manual / VPS

Install Chromium before starting the app (package name varies by Linux distribution). The server runs it headlessly for WhatsApp Web. Keep `WHATSAPP_AUTH_PATH` on persistent local storage and ensure the PM2 user can read and write it.

```bash
# Build
npm run build

# Set production env vars
export DATABASE_URL=...
export SESSION_SECRET=...
export SUPER_ADMIN_EMAILS=admin@dairyflow.com
export WHATSAPP_AUTH_PATH=/var/www/dairypro/.whatsapp-auth
export CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export NODE_ENV=production

# Start
npm start
```

### Database Migrations

When you update `shared/schema.ts`, apply changes to the database:

```bash
npm run db:push
```

For production database migrations, run this command against your production `DATABASE_URL`.

This alert release changes `alerts`, `whatsapp_logs`, and `notification_rules`, so `npm run db:push` is required before restarting the new build. The repository's VPS deploy script intentionally stops when `shared/schema.ts` changes; apply and review the schema update explicitly, then rerun deployment.

---

## License

MIT — see [LICENSE](../LICENSE) for details.

---

*Built with care for India's dairy farmers.*
