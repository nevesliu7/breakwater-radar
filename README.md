# Breakwater Radar

Cross-border operators now have to react to weather and policy shocks faster than their spreadsheets can keep up. I started thinking about this after watching small sellers treat every disruption as a one-off emergency: a flood delays a warehouse handoff, a tariff rule changes landed cost overnight, and the team has to search Slack, email, carrier notices, and government sites before anyone knows what to do. In 2026, that pattern became hard to ignore. USAFacts, using FEMA data, counted 74 U.S. disaster declarations from January through June 2026, already above the recent five-year average pace; July brought catastrophic Texas flooding with at least three deaths, more than 500 rescues, and a state disaster declaration covering 59 counties. On the social-policy side, U.S. Customs and Border Protection published a 2026 interim final rule that indefinitely suspends the de minimis exemption for imports valued at $800 or less arriving through non-postal modes, which means many low-value shipments now need formal or informal entry procedures. Those facts pushed me to build a small operating desk for this exact moment: one workspace that maps exposed assets, pulls public signals, and turns each risk into an action list.

Sources: [USAFacts FEMA disaster declaration tracker](https://usafacts.org/answers/how-many-disasters-are-declared-in-the-us/country/united-states/), [AP on July 2026 Texas floods](https://apnews.com/article/d9375deb56732e862408f93c32fd095e), [Federal Register CBP de minimis rule](https://www.federalregister.gov/documents/2026/06/24/2026-12670/indefinite-suspension-of-the-de-minimis-exemption-for-merchandise-arriving-through-all-modes-other)

## What It Does

Breakwater Radar is a backend-backed risk workspace for cross-border sellers and multi-location operators.

- Tracks two boards: `Natural disasters` and `Social policy`
- Maps alerts to facilities, lanes, SKUs, storefronts, and workforce locations
- Imports customer asset data from CSV templates
- Uploads playbooks, contracts, policy notes, and operating notes
- Pulls public signals from NOAA active alerts and Federal Register policy results
- Lets operators add manual alerts from suppliers, carriers, platforms, or local teams
- Scores readiness, flags blind spots, and saves action status changes
- Builds a tariff impact matrix from SKU origin, HTS code, category, user segment, and alternate supply origins
- Exports and restores the workspace as JSON

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional environment variables:

```bash
BREAKWATER_BASIC_AUTH_USER=operator
BREAKWATER_BASIC_AUTH_PASSWORD=
BREAKWATER_CRON_SECRET=
```

## Use The Product

1. Download the CSV templates from the `Data` section.
2. Fill in facilities, lanes, SKUs, storefronts, and workforce locations.
3. For tariff monitoring, add SKU `hts_code`, `category`, `user_segments`, and `alternate_origins`.
4. Upload each CSV to replace the demo workspace data.
5. Upload supporting documents such as 3PL playbooks, contracts, or policy notes.
6. Click `Sync now` to pull NOAA and Federal Register signals.
7. Review the `Risks` board by urgency, status, exposed asset type, and tariff matrix.
8. Move actions from `new` to `in-progress` to `done`.
9. Export the workspace JSON when you need a backup or handoff.

## Daily Updates

The app does not stream live news. It updates when an operator clicks `Sync now` or when a scheduler calls the cron endpoint.

```bash
curl -X POST "https://your-domain.com/api/cron/ingest" \
  -H "Authorization: Bearer $BREAKWATER_CRON_SECRET"
```

Use Vercel Cron, GitHub Actions, cron-job.org, or a server cron to run that request daily. Set `BREAKWATER_CRON_SECRET` in production if the endpoint is public.

## Deploy

This version is ready for self-serve pilots. Use a Node-capable host.

- Vercel, with database or blob storage replacing local file storage for production
- Render or Fly.io, with a persistent disk mounted for `data/`
- Railway or a VPS running `npm run build && npm run start`

For a shared pilot, set `BREAKWATER_BASIC_AUTH_PASSWORD` before deployment.

## Key API Routes

- `GET /api/workspace`
- `POST /api/import/csv?type=facilities|lanes|skus|storefronts|workforce_locations`
- `POST /api/import/document`
- `POST /api/ingest/public`
- `GET|POST /api/cron/ingest`
- `POST /api/alerts/manual`
- `PATCH /api/alerts/action-status`
- `GET /api/workspace/export`
- `POST /api/workspace/import`

## Storage

The current build is file-backed so a user can run it immediately.

- `data/workspace.json` stores the active workspace
- `data/uploads/` stores uploaded files
- Imports, source syncs, manual alerts, documents, action updates, and audit events persist on the server

For multi-customer production, replace the file store in [`lib/store.ts`](lib/store.ts) with Postgres and object storage.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

## Current Limits

- Public-source ingestion covers NOAA and Federal Register only
- File-backed storage is meant for one workspace, not multi-tenant production
- Basic Auth is enough for a small pilot, not enterprise identity
- Alert assignment, notifications, and approval workflows are not included yet
