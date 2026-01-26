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