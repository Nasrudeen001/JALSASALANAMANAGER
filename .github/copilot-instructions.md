## Quick orientation (what this repo is)

- Next.js (App Router) TypeScript app. Main UI lives under `app/` (server and client components). Shared UI bits are in `components/` and `components/ui/`.
- Business logic and integrations live in `lib/` (Supabase clients, auth helpers, export utilities, types). See `lib/supabase.ts`, `lib/supabase-server.ts`, `lib/auth.ts`, and `lib/export.ts` for the most important cross-cutting code.
- Tailwind + many Radix/third-party UI primitives. Project is configured for `pnpm`/`npm`/`yarn` workflows; `package.json` exposes `dev`, `build`, `start`, `lint`.

## High-level architecture you need to know

- App Router + Next 13 features: `app/layout.tsx` registers global fonts and wraps UI with `ClientLayout`.
- Client vs server Supabase use:
  - Browser client: `lib/supabase.ts` (used in client components). It builds a client with NEXT_PUBLIC keys.
  - Server client: `lib/supabase-server.ts` (call `createClient()` from server components/pages to access Supabase with request cookies).
- Auth: `lib/auth.ts` centralises login/logout/localStorage behaviour and role helpers (Admin, Attendance Register, Security Check, Catering Service). Navigation UI reads roles via `lib/auth.ts`.
- Export/Download area: `lib/export.ts` contains all PDF and Excel generation (jsPDF + jspdf-autotable for PDF; ExcelJS for Excel). If you need to change how downloads look or which fonts/sizes are used, start here.

## Developer workflows (commands)

- Install: `pnpm install` (or `npm install` / `yarn`). `pnpm-lock.yaml` exists so repo likely uses pnpm but npm also works.
- Run dev server: `pnpm dev` (maps to `next dev` in `package.json`).
- Build: `pnpm build` → `next build`. Note: `next.config.mjs` currently sets `typescript.ignoreBuildErrors = true` so builds can succeed even with TS errors — be careful when changing TS settings.
- Linting: `pnpm lint` runs `eslint .` (project includes ESLint config elsewhere). Use `pnpm` if you want reproducible installs.

## Project-specific patterns and gotchas

- Role-based UI visibility is driven by `lib/auth.ts` and `components/navigation.tsx`. The nav links specify roles explicitly — add/remove roles there when adding pages.
- Many components are client components (`"use client"`) and rely on `localStorage` for auth state. Server components should call `lib/supabase-server.ts` to read cookies/session.
- Fonts: the app uses Next font imports in `app/layout.tsx` (Geist family). However PDF exports use jsPDF built-in fonts (currently `helvetica`) in `lib/export.ts`, and Excel exports set font sizes / font metadata via ExcelJS. Changing app fonts does NOT automatically change PDF/Excel fonts.

## Where to change Download (PDF/Excel) fonts and sizes — concrete, actionable

Files to edit:
- `lib/export.ts` — contains all PDF and Excel generation code. Search for `setFont` / `setFontSize` / `font = { size:` to find all uses.

PDF (jsPDF) notes and example:
- Current code uses built-in font calls like `doc.setFont('helvetica', 'bold')` and `doc.setFontSize(14)` (see `drawCenteredPDFHeader` and many other locations).
- To switch to Georgia in PDFs you must embed/register the Georgia TTF with jsPDF. Rough steps (discoverable in codebase):
  1. Add a Georgia TTF file into `public/` or an assets folder.
  2. Use jsPDF APIs to add the font to VFS and register it before generating the doc (e.g., `doc.addFileToVFS('Georgia.ttf', base64Data); doc.addFont('Georgia.ttf', 'Georgia', 'normal'); doc.setFont('Georgia');`).
  3. Increase the numeric values passed to `doc.setFontSize(...)` by +1 where you want larger text. For example change `doc.setFontSize(14)` → `doc.setFontSize(15)`.
 4. Files: update all `doc.setFont(...)` and `doc.setFontSize(...)` call sites in `lib/export.ts` (search for occurrences). `drawCenteredPDFHeader`, `generateCommonIDCardContent`, and export helpers (e.g., `exportAttendanceToPDF`) are the main places.

Excel (ExcelJS) notes and example:
- `lib/export.ts` constructs Excel files using `ExcelJS.Workbook()` and sets font sizes like `titleCell.font = { size: 14, bold: true }`.
- To use Georgia and increase sizes by 1pt, update those font objects to include `name: 'Georgia'` and bump `size` by 1. Example change:
  - From: `titleCell.font = { size: 14, bold: true }`
  - To: `titleCell.font = { name: 'Georgia', size: 15, bold: true }`
- Update all places where `cell.font` or `*.font = { ... }` is assigned in `lib/export.ts` (search for `.font = {` and `font = { size:`).

Important: ExcelJS respects spreadsheet fonts but the viewer must have Georgia installed to render it exactly; embedding fonts into .xlsx is not done here — specifying `name: 'Georgia'` is the standard approach.

## Integration points and where features appear in the UI

- Export buttons in UI pages call the helpers in `lib/export.ts`. Example: `app/tajneed/page.tsx` contains a "Download PDF" button which calls export helpers.
- QR codes are generated via the `qrcode` package (see `lib/export.ts` → `generateQRCodeDataURL`).
- Supabase integration points: `lib/storage.ts` (data access), `lib/supabase.ts` (client), `lib/supabase-server.ts` (server client) — modify these for schema or table changes.

## Examples of patterns to mirror

- Use `lib/*` for cross-cutting logic (auth, export, storage). Keep components purely presentational in `components/` and `components/ui/`.
- When adding a new download format or changing PDF layout, update `lib/export.ts` and then the page that triggers it (e.g., `app/attendance/page.tsx`, `app/tajneed/page.tsx`).

## Quick pointers for common tasks

- Add server-side Supabase usage: call `await createClient()` from `lib/supabase-server.ts` inside server components/pages. Follow its cookie handling pattern.
- Add a new role or change navigation: update `lib/types.ts` for role union (if necessary), then `components/navigation.tsx` to change link visibility.
- Change global CSS / Tailwind: edit `app/globals.css` and `tailwind.config` (not present in root listing but standard location).

## What I didn't find (ask if you expect these)

- No `.github/copilot-instructions.md` previously existed — this file was added. If you have existing team AI instructions (AGENT.md/CLAUDE.md), paste them so I can merge them in.

---

If you want, I can: (A) apply the Georgia + +1pt changes automatically (I located every PDF/Excel font-size and font assignment in `lib/export.ts`) and run a quick smoke test in the browser, or (B) only add a TODO checklist in `lib/export.ts` linking to exact line numbers to change. Which would you prefer?

Please review and tell me if you want the automatic font changes applied now.
