## 2026-08-27T20:13:09Z
You are the Multi-Tenant & TypeScript Worker for Milestone M4.
Your Working Directory is: c:\Users\USER\Documents\app_xml_antigravity\.agents\worker_tenant_ts_m4
You MUST read:
- c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md
- c:\Users\USER\Documents\app_xml_antigravity\.agents\PROJECT.md
- c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_testing\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusively Owned Files:
- `server/src/controllers/portalController.ts`
- `server/src/controllers/bpoController.ts`
- `server/src/controllers/tenantsController.ts`

Your Tasks:
1. In `server/src/controllers/portalController.ts`:
   - ELIMINATE multi-tenant leaks: remove fallback `SELECT id FROM companies LIMIT 1` (lines 28-39 and lines 548-550).
   - If `company_id` is missing in `getDashboardSummary` or `listTaxGuides`, return `res.status(400).json({ success: false, error: 'company_id é obrigatório para isolamento multi-tenant' })`.
   - Ensure every query method strictly requires and enforces `company_id`.
2. In `server/src/controllers/bpoController.ts` & `server/src/controllers/tenantsController.ts`:
   - Fix NodeNext TypeScript module resolution imports: add `.js` extension to relative imports (e.g. `import { db } from '../database/db.js';`, `import { parseOfx } from '../services/ofxParser.js';`).
3. Verify server TypeScript compiles with 0 errors (`cd server && npx tsc --noEmit`).
4. Document all changes and verification in `c:\Users\USER\Documents\app_xml_antigravity\.agents\worker_tenant_ts_m4\handoff.md`. Send message when done.
