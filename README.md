# Facility Assessment Report Generator

A lightweight micro-app for evaluating skilled nursing facilities. Enter a facility's **CCN** (CMS
Certification Number), and the app pulls public CMS data, combines it with manual operational inputs, and
produces a polished, print-ready **PDF report** branded for the *INFINITE — Managed by MEDELITE* platform.

- **Live app:** _<add Vercel URL after deploy>_
- **Test facility:** CCN `686123` (Kendall Lakes Healthcare and Rehab Center, Miami FL)

---

## What it does (MVP)

- **Dynamic CCN lookup** — enter any valid 6-digit CCN to fetch that facility.
- **CMS data engine** — auto-fills the official name, location, certified beds, and the four CMS star
  ratings from the public **CMS Provider Data Catalog**.
- **Facility-name override** — defaults to the CMS legal name; an optional field overrides it on the
  report body only.
- **Manual operational inputs** — EMR, Current Census, Type of Patient, Previous Coverage (Yes/No),
  Previous Provider Performance, and Medical Coverage.
- **One-click PDF** — a single button generates and downloads a clean snapshot report.
- **Clickable Medicare source link** — the PDF contains a real, clickable hyperlink to the facility's
  official Medicare *Care Compare* profile, built from the dynamic CCN.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm run start   # production build
```

No environment variables or API keys are required — the CMS Provider Data API is public and keyless.

## Architecture

```
Browser (React form + client-side PDF)
        │  GET /api/facility/[ccn]   ← only the public CCN ever leaves the browser
        ▼
Next.js Route Handler (server-side proxy)
        │  fetch + normalize
        ▼
CMS Provider Data Catalog API  (data.cms.gov)
```

- **Server-side proxy (`/api/facility/[ccn]`)** — the CMS API does **not** send CORS headers, so a
  browser‑direct call is blocked in production. A thin Next.js route proxies the request server‑to‑server
  (CORS‑exempt), validates the CCN, normalizes the data, and returns a typed object.
- **Client-side PDF generation** (`@react-pdf/renderer`) — the report is assembled **in the browser**, so
  the confidential manual inputs never reach our server. The library emits real selectable text and a real
  clickable link annotation (not a rasterized screenshot).

### Data sources & field mapping

| Report field | Source |
| --- | --- |
| Name, Location, Census Capacity (certified beds), 4 star ratings, State | CMS **Provider Information** (`4pq5-n9py`) |
| EMR, Current Census, Type of Patient, Previous Coverage, Previous Provider Performance, Medical Coverage | Manual input |

`Census Capacity` maps to the CMS *Number of Certified Beds*; `Quality of Resident Care` maps to the CMS
*QM Rating*. (The 12 short‑/long‑stay hospitalization & ED metrics are a planned bonus — see below.)

## Assumptions & decisions

- **The provided sample report is a layout reference, not a values reference.** CMS refreshes this data
  roughly monthly, so live figures differ from the sample (e.g. for `686123`, certified beds and several
  star ratings have changed). The app always drives values from the **live API** and stamps each report
  with the CMS *data as of* date. Numbers will intentionally differ from any older sample.
- **Current Census is a manual input.** The brief's field‑mapping table lists it as manual, so it is a
  form field. (The CMS *average residents per day* is shown only as a placeholder hint.)
- **Medicare link uses the base detail URL** `…/care-compare/details/nursing-home/{CCN}` (verified to
  resolve). The sample's `…/view-all?state=FL` suffix is an in‑app filter view and is not required.
- **No authentication / no database.** The app reads only public data and persists nothing; auth would
  protect nothing in this design. (It would become warranted if reports or inputs were ever persisted.)

## Security & privacy

This app handles **public** CMS data plus **confidential business** inputs — there is **no PHI / no personal
data**, so the governing concern is commercial confidentiality, addressed by architecture:

- **Data minimization** — only the public CCN is sent to the server. The six manual inputs never leave the
  browser (the PDF is generated client‑side), so they are never logged, cached, or persisted anywhere.
- **Stateless** — no database, no server‑side storage of any request or input.
- **Hardened proxy** — the CCN is validated against a strict `^[0-9]{6}$` allowlist before any outbound
  call; the upstream host/dataset/query are fixed server constants (no SSRF / open‑relay surface); the CCN
  is passed only as an encoded query value; upstream errors return generic messages (no internals leaked);
  responses are cached only on success.
- **Untrusted‑input handling** — CMS numerics (returned as strings) are coerced with null guards; star
  ratings are clamped to 1–5 or shown as “Not Rated”; missing facilities return a clean not‑found state.
- **Response headers** — a nonce‑based Content‑Security‑Policy (`script-src 'self' 'nonce' 'strict-dynamic'`
  in production — no `unsafe-inline` on scripts), plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, and HSTS.
- **No secrets** — the CMS API is keyless, so the app holds no upstream secret; nothing sensitive is
  committed to this public repo.

## Tech stack

Next.js (App Router) · React · TypeScript · `@react-pdf/renderer` · deployed on Vercel.

## Roadmap (optional bonuses)

- The 12 short‑/long‑stay hospitalization & ED metrics with national and state averages (claims‑based
  measures `ijh5-nb2v` + state averages `xcdc-v8bm`), with correct unit handling (% vs. per‑1,000
  resident‑days).
- Word (.docx) export, charts/data cards, and expanded edge‑case handling.
