# Breakwater Radar PRD

*Version 0.1, dated 2026-07-28*

## 1. Product Summary

Breakwater Radar is a lightweight control tower for distributed commerce operators. It turns two external risk classes, natural disasters and social policy, into asset-level exposure and action guidance.

This repository implements the first GitHub-ready MVP.

## 2. Launch Wedge

### Beachhead ICP
- Cross-border sellers shipping into the United States
- 2-200 employee teams
- One or more 3PLs, warehouses, or channel storefronts
- No dedicated risk or compliance operations team

### Expansion ICP
- Multi-location operators with 2-20 stores or fulfillment nodes
- Service or retail operators exposed to regional weather and local policy changes

## 3. Core Problem

Operators can usually see risk headlines, but they cannot quickly answer:

1. Which assets are exposed?
2. How urgent is the disruption?
3. What should the team do in the next 24 hours?
4. Which playbook should be reused after the event?

## 4. Product Thesis

The smallest useful version is not a general intelligence feed. It is a two-board operating product that starts from the user's asset map and translates a limited set of disruption signals into recommended actions.

## 5. User Lifecycle

| Stage | User need | MVP response |
|---|---|---|
| Onboarding | Provide a clean view of facilities, lanes, SKUs, channels, and workforce footprints | CSV template download and upload |
| Context build | Attach supporting documents and local notes | Supplemental document upload with metadata |
| Quiet monitoring | Watch the environment without noise | Ranked board views and digest cards |
| Pre-event planning | Stage actions before a disruption hits | Alert detail with exposure counts and timeline |
| Active response | Coordinate what changes in the next 24 hours | Action checklist per alert |
| Recovery and learning | Reuse what worked next time | Stored playbooks and documented inputs |

## 6. MVP Scope

### Included
- File-backed workspace with seeded demo data
- CSV template download for five asset groups
- CSV upload that replaces each current asset group
- Supplemental document upload to a local workspace vault
- Natural disasters board
- Social policy board
- Deterministic risk score based on severity, timing, confidence, and exposure
- Alert detail with source links, impact summary, and action checklist
- Board filters for status, urgency, and impact surface
- Persistent action status updates for live response work
- Readiness scoring, missing-input hints, and blind-spot detection
- Manual public-source ingestion for NOAA active alerts and Federal Register trade-policy results
- Workspace audit trail for imports, document uploads, public pulls, and action status updates

### Excluded
- Authentication
- Fully scheduled external crawling
- Role permissions
- Deep ERP integrations
- Automated notification channels beyond the in-app digest

## 7. Boards

### Natural Disasters Board
Tracks:
- Storm and typhoon threats
- Flood and flash flood risk
- Heatwave risk
- Wildfire and smoke disruption
- Transport interruption tied to weather

Questions answered:
- Which facilities, lanes, or storefronts are exposed?
- How soon does the event matter?
- Which ops actions should happen in the next 24 hours?

### Social Policy Board
Tracks:
- Tariff and customs changes
- Platform policy shifts
- Labor and compliance changes
- Regional operating restrictions

Questions answered:
- Which SKUs, markets, or teams are exposed?
- Is this margin, compliance, or customer-promise risk?
- What must change immediately?

## 8. Data Model

### Asset entities
- Facilities
- Lanes
- SKUs
- Storefronts
- Workforce locations

### Operating documents
- Playbooks
- Contracts and SLA notes
- Policy memos
- Internal process notes

### Alert entities
- Board
- Risk type
- Severity
- Confidence
- Hours to impact
- Locations
- Source links
- Action items

## 9. Risk Scoring Logic

The MVP score is deterministic:

`score = severity + urgency + exposure + criticality + confidence`

Operationally, that means:
- Higher severity pushes the alert up
- Shorter time to impact pushes the alert up
- More exposed assets push the alert up
- Core assets push the alert up
- Better source confidence pushes the alert up

## 10. Input Design

### Structured input
Users download and fill these files:
- `facilities.csv`
- `lanes.csv`
- `skus.csv`
- `storefronts.csv`
- `workforce_locations.csv`

### Unstructured input
Users can upload:
- 3PL or carrier playbooks
- Team operating notes
- Policy memos
- Internal SOPs

## 11. UI Structure

### Home / control center
- Hero and status strip
- Intake hub
- Readiness and blind-spot panels
- Board switcher
- Selected alert detail
- Document vault

### Board behavior
- Default sort: highest score first
- Search within current board
- Filter by urgency, status, and exposed asset type
- Show impacted asset counts directly on each card

### Alert detail behavior
- Status, risk score, and next watch window
- Affected facilities, lanes, SKUs, storefronts, and workforce
- Action checklist
- Action progression from new to in progress to done
- Source links

### Public source behavior
- NOAA alerts are pulled for U.S. states found in the imported asset map
- Federal Register results are pulled for tariff, customs, import, and trade terms
- Source ids are deduplicated before alerts are added
- Each ingest run writes an audit event

## 12. Acceptance Criteria

The MVP is acceptable when:

1. The repo can be cloned and run with `npm install && npm run dev`
2. A user can download every template
3. A user can upload each CSV type and see the workspace update
4. A user can upload supplemental files and see them listed in the document vault
5. Alerts are re-ranked based on uploaded asset exposure
6. A user can update action status and see counts change
7. The UI clearly distinguishes the two boards, shows next-step actions, and highlights setup blind spots
8. A user can manually pull public sources and see live-source alerts added without duplicating existing ids
9. Recent imports, uploads, public pulls, and action changes appear in the audit trail

## 13. Post-MVP Priorities

1. More public and platform source connectors
2. Scheduled ingest jobs and source health monitoring
3. Saved alert assignments and action completion
4. Email or Slack digests
5. Database-backed multi-tenant workspaces
6. Scenario simulations and postmortem reports
