# Package Use Cases — xellabs

> **Project:** xellabs (HIPAA / Healthcare Compliance — Next.js 16)
> **Last updated:** 2026-06-29

---

## Core Framework

| Package | Version | Category | Use Case |
|---------|---------|----------|----------|
| `next` | 16.2.9 | Framework | Next.js App Router — pages, API routes, middleware, SSR/SSG |
| `react` | 19.2.4 | Framework | UI component model |
| `react-dom` | 19.2.4 | Framework | React DOM renderer |

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
