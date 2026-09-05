## 2026-08-27T20:08:05Z
You are the Frontend Survey Explorer.
Your Working Directory is: c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_frontend
You MUST read the original request file: c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md

Task:
1. Thoroughly investigate the frontend codebase (client, src, components, views, services, hooks, stores).
2. Inspect `ClientPortalView.tsx` and all child components / widgets.
3. Enumerate EVERY hardcoded mock value, placeholder number, simulated calculation (e.g. "R$ 145.892,30", "R$ 884k", hardcoded tax cards, mock charts, fake percentages).
4. Inspect how the current company context (`company.id` / selected company) is provided to `ClientPortalView.tsx`.
5. Map out the API client methods / fetch calls needed to consume:
   - `GET /api/portal/dashboard-summary?company_id=XYZ`
   - `GET /api/portal/tax-guides?company_id=XYZ`
6. Specify exact UI state handling: loading, error, empty state (must display R$ 0,00 when company has no data, never mock fallbacks).
7. Detail required refactoring in `ClientPortalView.tsx` and related components.
8. Write your detailed survey report to `c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_frontend\handoff.md`.
9. Send a message to parent when complete.
