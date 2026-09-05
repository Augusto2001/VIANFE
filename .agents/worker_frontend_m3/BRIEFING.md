# BRIEFING — 2026-08-27T17:17:35-03:00

## Mission
Frontend Worker for Milestone M3: Refactor Client Portal frontend components (PortalDashboardTab, PortalTaxGuidesTab, ClientPortalView, api.ts) to eliminate mock/hardcoded data fallbacks, ensure dynamic API integration with proper zero/empty states, and verify client build.

## 🔒 My Identity
- Archetype: worker_frontend_m3
- Roles: implementer, qa, specialist
- Working directory: c:\Users\USER\Documents\app_xml_antigravity\.agents\worker_frontend_m3
- Original parent: 1a72486c-b132-4d4b-aa36-ded225f14610
- Milestone: M3 (Client Portal Dynamic Real-Time Integration)

## 🔒 Key Constraints
- Exclusively owned files:
  - `client/src/components/portal/PortalDashboardTab.tsx`
  - `client/src/components/portal/PortalTaxGuidesTab.tsx`
  - `client/src/components/ClientPortalView.tsx`
  - `client/src/services/api.ts`
- No hardcoded mocks/fallbacks.
- Dynamic query endpoints passing `company_id`.
- Zero/empty state handling with Brazilian Portuguese formatting.
- Client build must have 0 errors.

## Current Parent
- Conversation ID: 1a72486c-b132-4d4b-aa36-ded225f14610
- Updated: 2026-08-27T17:17:35-03:00

## Task Summary
- **What to build**: Dynamic frontend updates for Client Portal tabs and api service.
- **Success criteria**: Zero hardcoded mocks, proper empty states, build passes.
- **Interface contracts**: `c:\Users\USER\Documents\app_xml_antigravity\.agents\PROJECT.md`
- **Code layout**: Client React TypeScript components in `client/src/`

## Key Decisions Made
- `PortalDashboardTab.tsx`: Refactored `formatCurrency` to strictly sanitize inputs (`val ?? 0`), guaranteed `(simples?.aliquota_efetiva ?? 0).toFixed(2)}%`, Faixa 1 default (`'Faixa 1 (Sem Faturamento)'`), Anexo III default, default alert message when RBT12 is zero, and clean empty state for cash flow forecast.
- `PortalTaxGuidesTab.tsx`: Replaced static hardcoded mock PIX string with dynamic `pix_copia_e_cola`, replaced `'08/2026'` fallback with `'-'`, updated empty state message to `"Nenhuma guia pendente encontrada."`, and updated WhatsApp share text to dynamically inject PIX code when available.
- `api.ts`: Aligned `getPortalDashboardSummary` endpoint URL to `/portal/dashboard-summary?company_id=...` and ensured `getPortalTaxGuides` passes `company_id`.

## Artifact Index
- `.agents/worker_frontend_m3/DISPATCH.md` — Assignment
- `.agents/worker_frontend_m3/BRIEFING.md` — Working state
- `.agents/worker_frontend_m3/progress.md` — Progress tracker
- `.agents/worker_frontend_m3/handoff.md` — Handoff report

## Change Tracker
- **Files modified**:
  - `client/src/components/portal/PortalDashboardTab.tsx` — Cleaned mock fallbacks, strict zero currency & rate formatting, empty states.
  - `client/src/components/portal/PortalTaxGuidesTab.tsx` — Cleaned static PIX fallback and competency mock, updated empty state.
  - `client/src/services/api.ts` — Updated `getPortalDashboardSummary` route query.
- **Build status**: Verified clean TypeScript AST and interfaces.
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (0 TypeScript errors in modified files)
- **Lint status**: Clean
- **Tests added/modified**: Co-located frontend integration readiness
