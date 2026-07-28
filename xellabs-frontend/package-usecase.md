# Package Use Cases — xellabs

> **Project:** xellabs (HIPAA / Healthcare Compliance — Next.js 16)
> **Last updated:** 2026-07-22

---

## Core Framework

| Package | Version | Category | Use Case |
|---------|---------|----------|----------|
| `next` | 16.2.9 | Framework | Next.js App Router — pages, API routes, middleware, SSR/SSG |
| `react` | 19.2.4 | Framework | UI component model |
| `react-dom` | 19.2.4 | Framework | React DOM renderer |
| `jsqr` | 1.4.0 | Barcode/QR | Client-side QR code decoding from device camera frames (getUserMedia + canvas) — storage location label scanning in New Sample / Sample Receipt |
| `@liji-table/core` | 0.0.8-beta.0 | Data Table | Headless table engine (sort/global search/pagination/row selection/column pin/reorder/resize) — the logic layer behind the app's single shared `DataTable` component (`app/dashboard/_components/DataTable.tsx`), used by every list page instead of a hand-rolled `<table>` |
| `@liji-table/react` | 0.0.8-beta.0 | Data Table | React binding (`useLijiTable` hook) for `@liji-table/core` |
| `jsbarcode` | 3.12.3 | Barcode/QR | Renders Code128/Code39 barcodes onto `<canvas>`/`<svg>` — sample and storage-label sticker printing (`LiveBarcode.tsx`, `stickerTemplates.ts`) |
| `qrcode` | 1.5.4 | Barcode/QR | Generates QR codes (as data URLs) for storage location/slot labels and sticker templates (`StorageShell.tsx`, `stickerTemplates.ts`) |
| `recharts` | 3.9.0 | Charts | Dashboard analytics charts (`DashboardCharts.tsx`) |
| `sharp` | 0.34.5 | Image Processing | Next.js's own image-optimization pipeline (`next/image`) — not imported directly in app code |
| `xlsx` | 0.18.5 | Data Import | Parses `.xlsx`/`.xls` instrument-result files (in addition to CSV) for the Worksheet result-import flow (`WorksheetDetailShell.tsx`) |
| `@superset-ui/embedded-sdk` | 0.4.0 | Analytics | Embeds Apache Superset dashboards in an iframe with signed-guest-token auth (`SupersetDashboard.tsx`) |

---

## Security (HIPAA Compliance)

| Package | Version | Category | Use Case |
|---------|---------|----------|----------|
| `zod` | 4.4.3 | Validation | Runtime schema validation for all user inputs and PHI (Protected Health Information) before it reaches business logic or database |
| `bcryptjs` | 3.0.3 | Cryptography | Secure password hashing using bcrypt (adaptive cost factor); satisfies HIPAA Access Control requirement (§164.312(a)) |
| `jose` | 6.2.3 | Cryptography | JWT signing (JWS) and encryption (JWE); edge-runtime compatible — used in Next.js middleware for stateless session tokens and encrypted PHI payloads |
| `next-auth` | 4.24.14 | Authentication | Authentication framework — manages sessions, OAuth providers, credential login, and callbacks; foundation for HIPAA User Authentication (§164.312(d)) |
| `rate-limiter-flexible` | 11.2.0 | Security | Brute-force and DDoS protection on auth endpoints and PHI-access APIs; supports in-memory, Redis, and MongoDB backends |
| `helmet` | 8.2.0 | Security Headers | HTTP security headers — Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy; mitigates XSS, clickjacking, MIME sniffing |

---

## Dev / Tooling

| Package | Version | Category | Use Case |
|---------|---------|----------|----------|
| `typescript` | ^5 | Tooling | Static type checking — reduces runtime errors in PHI-handling code |
| `eslint` | ^9 | Tooling | Code linting |
| `eslint-config-next` | 16.2.9 | Tooling | Next.js-specific ESLint rules |
| `tailwindcss` | ^4 | Styling | Utility-first CSS framework |
| `@tailwindcss/postcss` | ^4 | Styling | PostCSS integration for Tailwind |
| `@types/node` | ^20 | Types | Node.js TypeScript definitions |
| `@types/react` | ^19 | Types | React TypeScript definitions |
| `@types/react-dom` | ^19 | Types | React DOM TypeScript definitions |
| `@types/jsbarcode` | ^3.11.4 | Types | TypeScript definitions for `jsbarcode` |
| `@types/qrcode` | ^1.5.6 | Types | TypeScript definitions for `qrcode` |

---

## HIPAA Control Mapping

| HIPAA Control | §Reference | Package(s) |
|---------------|-----------|------------|
| Access Control | §164.312(a) | `next-auth`, `bcryptjs`, `jose` |
| Audit Controls | §164.312(b) | _(pending)_ |
| Integrity Controls | §164.312(c) | `zod`, `jose` |
| Person/Entity Authentication | §164.312(d) | `next-auth`, `bcryptjs` |
| Transmission Security | §164.312(e) | `jose`, `helmet` |
| Automatic Logoff | §164.312(a)(2)(iii) | `next-auth` (session expiry) |
| Brute-force Protection | §164.312(a) | `rate-limiter-flexible` |
