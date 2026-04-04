# DairyFlow - Multi-Tenant Dairy Farm ERP

## Overview

DairyFlow is a production-ready, multi-tenant SaaS Dairy Farm ERP system for Indian dairy farms with herd sizes from 1 to 500 cattle. It provides comprehensive management including cattle tracking, milk production, breeding, health, feed, inventory, and financial tracking. The system is an offline-first Progressive Web App (PWA) targeting Android and web platforms, designed for a farmer-first, labor-proof user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui built on Radix UI, styled with Tailwind CSS (light/dark mode)
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API Design**: RESTful JSON APIs
- **Authentication**: Replit Auth with Passport.js
- **Session Management**: Express sessions stored in PostgreSQL

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema**: Defined in `shared/schema.ts`
- **Migrations**: Managed via drizzle-kit

### Multi-Tenancy
- Tenant isolation with a `tenants` table
- Each tenant has an owner, plan tier, and cattle limits
- Role-based permissions (owner, manager, worker)
- All data tables include a `tenantId` for data isolation

### Authentication
- Replit Auth handles OIDC user authentication
- Sessions stored in `sessions` table in PostgreSQL
- User records in `users` table
- Automatic tenant creation for new users

### Key Features
- **Comprehensive Dairy Farm Management**: Cattle, Milk, Health, Breeding, Feed, Inventory, Finances.
- **Reporting & Analytics**: Detailed reports for Milk, Cattle, Health, Finance, Breeding with CSV export.
- **Bulk Import/Export**: Data import and export functionality with filtering and validation for various modules.
- **Cattle Sale & Purchase Module**: Tracks purchases, sales, and profit/loss per animal.
- **Byproducts Management Module**: Records transactions for byproducts (e.g., cow dung) with optional inventory tracking.
- **Universal Attachments System**: Supports image, PDF, and audio file uploads (max 10MB) linked to various records, configurable for S3/Supabase.
- **Dynamic Dashboard**: Provides KPIs for Herd, Expected Actions, Milk, Finance, Health, and Breeding performance.
- **Detailed Cattle Profiles**: Individual cattle pages with basic info, breeding timeline, milking history, health, financials, and general timeline.
- **Billing & Plans**: Manages subscription plans (Free/Starter/Basic/Pro/Enterprise) with usage tracking.
- **Extensive Settings**: Customizable farm, milking, breeding, notifications, WhatsApp integration, and storage settings.
- **Master Data Management**: Pre-seeded master data for breeds, vaccines, feed items, expense/income heads, and inventory categories.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store
- **Drizzle ORM**: For database interactions

### Authentication
- **Replit Auth**: OpenID Connect provider

### UI Framework
- **Radix UI**: Accessible UI primitives
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library

### Data Fetching
- **TanStack React Query**: Server state management

### Third-Party Integrations
- **Stripe**: Payment processing
- **Nodemailer**: Email notifications
- **OpenAI/Google Generative AI**: AI capabilities
- **xlsx**: Excel file processing for import/export functionality