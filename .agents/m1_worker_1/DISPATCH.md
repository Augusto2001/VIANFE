# M1 Worker 1 Dispatch (Backend Foundations & Core Services)

## Mission
Implement all backend foundations, database tables, business engines, controllers, and REST routes for Super App Viacont (Client Area) according to the specifications provided by M1 Explorers 1, 2, and 3.

Working directory: c:\Users\USER\Documents\app_xml_antigravity\.agents\m1_worker_1
Workspace root: c:\Users\USER\Documents\app_xml_antigravity
Original request: c:\Users\USER\Documents\app_xml_antigravity\ORIGINAL_REQUEST.md
Project plan: c:\Users\USER\Documents\app_xml_antigravity\PROJECT.md

## Reference Plans:
- Schema & Seeds: `c:\Users\USER\Documents\app_xml_antigravity\.agents\m1_explorer_1\m1_schema_plan.md`
- Business Services & Engines: `c:\Users\USER\Documents\app_xml_antigravity\.agents\m1_explorer_2\m1_service_plan.md`
- Controllers, Types & Routes: `c:\Users\USER\Documents\app_xml_antigravity\.agents\m1_explorer_3\m1_routes_plan.md`

## Files Owned Exclusively by this Worker:
- `server/src/database/db.ts`
- `server/src/services/portalService.ts`
- `server/src/controllers/portalController.ts`
- `server/src/types/portal.ts`
- `server/src/routes/api.ts`

## Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Deliverables & Verification:
1. Implement full schema and tables in `server/src/database/db.ts` (`tax_guides`, `receipts_ocr`, `favorite_catalog_items`, `recurring_clients`, and seed data).
2. Implement full `server/src/types/portal.ts`.
3. Implement full business logic in `server/src/services/portalService.ts` (EMV PIX generator with CRC16, Simples Nacional RBT12 engine, OCR receipt extraction & auto-match, WhatsApp share builder).
4. Implement all controller methods in `server/src/controllers/portalController.ts`.
5. Register `/api/portal/*` routes in `server/src/routes/api.ts`.
6. Run `npm run build --prefix server` and verify it compiles with 0 errors.
7. Write your `handoff.md` and `progress.md` and send_message to orchestrator.

## 2026-08-27T11:16:39Z
**Context**: Milestone M1 Backend Foundations Implementation
**Content**: Checking in on progress of the implementation steps (Schema, Types, Services, Controllers, Routes, and `npm run build --prefix server`).
**Action**: Please report current status and ETA.

