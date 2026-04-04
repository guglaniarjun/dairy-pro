# DairyFlow - Multi-Tenant Dairy Farm ERP

## Overview

DairyFlow is a production-ready, multi-tenant SaaS Dairy Farm ERP system designed for India. The application supports herd sizes from 1 to 500 cattle and provides comprehensive dairy farm management including cattle tracking, milk production records, breeding management, health monitoring, feed management, inventory control, and financial tracking.

The system is built as an offline-first Progressive Web App (PWA) targeting both Android (via installable PWA) and web platforms with a farmer-first, labour-proof UX design.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with React plugin
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON APIs under `/api` prefix
- **Authentication**: Replit Auth integration using OpenID Connect with Passport.js
- **Session Management**: Express sessions stored in PostgreSQL via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all database table definitions
- **Migrations**: Managed via drizzle-kit with `db:push` command

### Multi-Tenancy Model
- Tenant-based isolation with `tenants` table storing farm organizations
- Each tenant has owner, plan tier (free/demo/paid), and cattle limits
- Tenant members with role-based permissions (owner, manager, worker)
- All data tables include `tenantId` foreign key for data isolation

### Authentication Flow
- Replit Auth handles user authentication via OIDC
- Sessions stored in PostgreSQL `sessions` table
- User records stored in `users` table with profile information
- Automatic tenant creation for new users

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/  # UI components including shadcn/ui
│       ├── hooks/       # Custom React hooks
│       ├── lib/         # Utilities and query client
│       └── pages/       # Page components
├── server/           # Express backend
│   ├── replit_integrations/  # Replit Auth integration
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database operations
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   ├── schema.ts     # Drizzle database schema
│   └── models/       # Shared type definitions
└── migrations/       # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication
- **Replit Auth**: OpenID Connect authentication via `ISSUER_URL` (defaults to `https://replit.com/oidc`)
- **Required Environment Variables**: `REPL_ID`, `SESSION_SECRET`, `DATABASE_URL`

### UI Framework Dependencies
- **Radix UI**: Accessible UI primitives (dialog, dropdown, tabs, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management

### Data Fetching
- **TanStack React Query**: Server state management with caching
- **Fetch API**: Native browser fetch for API requests

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the codebase

### Third-Party Integrations (from package.json)
- **Stripe**: Payment processing (for paid plan subscriptions)
- **Nodemailer**: Email notifications
- **OpenAI/Google Generative AI**: AI capabilities
- **xlsx**: Excel file processing for reports/exports

## Recent Changes

### April 4, 2026 (Session 3)
- **Missing Forms Added**: All module form pages now exist and are functional:
  - `/feed/new` - Record Feeding form (select cattle, feed item, session, quantity)
  - `/feed/formulation` - Diet Formulation calculator (estimate daily feed needs from milk yield + body weight)
  - `/health/new` - Report Health Issue form (illness, injury, checkup, deworming)
  - `/health/vaccination` - Record Vaccination form (cattle, vaccine type, date, batch, next due)
  - `/finances/expense/new` - Record Expense form (category, amount, vendor, payment method)
  - `/finances/income/new` - Record Income form (category, amount, customer, payment method)
  - `/tasks/new` - Add Task form (title, type, priority, due date, linked cattle)
  - `/inventory/new` - Add Inventory Item form (name, category, unit, opening stock)
  - `/inventory/purchase` - Record Purchase form (item, quantity, unit cost, batch, expiry)
  - `/inventory/issue` - Issue Stock form (item, type: issue/wastage/adjustment, quantity)
- **Routes Fixed**: `/health/new` was incorrectly mapped to `HealthPage` - now maps to `HealthNewPage`
- **Feed Stats Fixed**: Hardcoded "18.5 kg" and "₹8.50" replaced with real computed stats
- **Health ID Type Fixed**: Health resolve mutation now uses `string` type for UUIDs (was `number`)
- **Inventory Transactions**: Added backend storage methods and API routes (`GET/POST /api/inventory/transactions`). Stock is automatically updated when purchase/issue is recorded.
- **Routes Added**: All above pages registered in App.tsx

### April 4, 2026 (Session 2)
- **Breeding Module Depth**: Expected events page (Heat Due, PT Due, Calving Due, Dry Off Due, Repeat Breeders). AI Records with pregnancy status. All tabs populated with real data. New forms: /breeding/ai, /breeding/pregnancy-test, /breeding/calving.
- **Health Module Depth**: 3-tab layout (Issues, Vaccinations Due, History). Vaccination due list grouped by cattle with DaysBadge. Quick resolve button. Real count KPI cards.
- **Finance Module Depth**: 6 KPI cards including cost/kg milk, milk sales, feed cost. Cost Analysis tab with category breakdown charts. Period filtering across all tabs.
- **Reports Module**: 5 tabbed reports (Milk, Cattle, Health, Finance, Breeding) with real data. CSV export for all report types. Daily milk summary, cow-wise breakdown, session analysis, herd composition charts.
- **Mobile Bottom Nav**: Fixed bottom navigation bar (Home/Cattle/Milk/Breeding/Alerts) visible only on mobile (<md). Alert badge shows live count.
- **Routes Added**: /breeding/ai, /breeding/pregnancy-test, /breeding/calving registered in App.tsx.

### April 4, 2026 (Session 1)
- **Dashboard Overhaul**: 6 KPI groups with real data: Herd Summary, Expected Actions (next 30 days), Milk Snapshot, Finance Snapshot, Health & Vaccination, Breeding Performance. All cards clickable with drill-down links. Plan usage bar in sidebar.
- **Cattle Detail Page**: Full `/cattle/:id` route with tabs: Basic Info, Breeding Timeline, Milking History, Health & Vaccination, Financials, Timeline. Shows DIM, lactation, key KPIs in header.
- **Billing Page**: `/billing` with plan comparison (Free/Starter/Basic/Pro/Enterprise), current plan usage progress bar, Razorpay-ready upgrade CTAs.
- **Settings Expansion**: 6 tabs — Farm, Milking, Breeding, Notifications, WhatsApp (dual mode: Web QR + Business API with test message + log), Storage. All settings persisted to DB.
- **Sidebar**: Live alerts badge from real API data. Billing nav item added. Active state fixed to use startsWith for nested routes.
- **Smart Dashboard Stats**: `getDashboardStats` now returns ~30 KPI fields including expected breeding events, conception rate, month finance totals, cost/kg milk.

### January 27, 2026
- **Cattle Sale & Purchase Module**:
  - Purchase form with partial/complete payment options
  - Sale form with P/L calculation based on purchase costs, expenses, and milk revenue
  - P/L Dashboard showing profit/loss per animal with filtering and search
  - Routes: /cattle/purchase, /cattle/sale, /cattle/pl

- **Byproducts Management Module**:
  - Transaction recording for all byproduct types (cow dung, manure, biogas, vermicompost, etc.)
  - Optional inventory tracking based on tenant settings
  - Reports tab with analytics: breakdown by type, monthly trends, top customers/suppliers
  - Route: /byproducts

- **Universal Attachments System**:
  - S3/Supabase storage configuration in Settings > Storage
  - AttachmentUploader component added to: cattle, milk, breeding heat, cattle purchase/sale, byproduct transactions
  - 10MB max file size limit
  - Supports images, PDFs, and audio files

- **Tenant Settings**:
  - Accounting mode toggle (simple/full)
  - Byproduct inventory tracking toggle
  - Storage provider configuration (local/s3/supabase)

- **Database Schema Additions**:
  - cattle_transactions (purchase/sale records)
  - byproduct_types, byproduct_transactions, byproduct_inventory
  - attachments, attachment_links
  - tenant_settings, system_settings

- **API Endpoints Added**:
  - POST/GET /api/cattle-transactions - cattle purchase/sale
  - GET /api/cattle-transactions/pl - profit/loss data
  - GET /api/byproduct-types - byproduct master data
  - POST/GET /api/byproduct-transactions - byproduct sales/purchases
  - GET /api/byproduct-inventory - inventory levels
  - POST /api/attachments/upload - file upload
  - GET/POST /api/tenant-settings - tenant configuration

### January 26, 2026
- **Master Data Seeding**: Added seed script (server/seed.ts) to populate:
  - 10 cattle breeds (Holstein, Jersey, Gir, Sahiwal, etc.)
  - 10 vaccines (FMD, HS, BQ, Brucellosis, etc.)
  - 14 feed items (roughage, concentrates, supplements)
  - 10 expense heads and 7 income heads
  - 5 inventory categories

- **Master Data API Endpoints** (no auth required):
  - GET /api/breeds - cattle breeds
  - GET /api/vaccines - vaccination types
  - GET /api/feed-items - feed ingredients
  - GET /api/expense-heads - expense categories
  - GET /api/income-heads - income categories
  - GET /api/inventory-categories - inventory types

- **Authentication Integration**:
  - Fixed AuthProvider export for proper React context
  - Updated withTenant middleware to use Replit Auth claims format (req.user.claims.sub)
  - Automatic tenant creation for new authenticated users

- **End-to-End Testing**: Verified all user journeys including:
  - Landing page and authentication flow
  - Dashboard with stats
  - Cattle management (list, add, edit)
  - Milk recording
  - Health tracking
  - Breeding management
  - Feed management
  - Inventory control
  - Financial tracking
  - Reports and alerts

## Running Commands

- `npm run dev` - Start development server
- `npm run db:push` - Push schema changes to database
- `npx tsx server/seed.ts` - Seed master data (run once after db:push)