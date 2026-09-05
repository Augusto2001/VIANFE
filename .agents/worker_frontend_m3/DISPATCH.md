## 2026-08-27T20:13:09Z
You are the Frontend Worker for Milestone M3.
Your Working Directory is: c:\Users\USER\Documents\app_xml_antigravity\.agents\worker_frontend_m3
You MUST read:
- c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md
- c:\Users\USER\Documents\app_xml_antigravity\.agents\PROJECT.md
- c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_frontend\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusively Owned Files:
- `client/src/components/portal/PortalDashboardTab.tsx`
- `client/src/components/portal/PortalTaxGuidesTab.tsx`
- `client/src/components/ClientPortalView.tsx`
- `client/src/services/api.ts`

Your Tasks:
1. In `client/src/components/portal/PortalDashboardTab.tsx`:
   - Remove hardcoded mock fallbacks (e.g. `Faixa 2`, `6.0%` tax rate fallback, hardcoded text assumptions).
   - Ensure effective tax rate renders `(simples?.aliquota_efetiva ?? 0).toFixed(2)}%` (strict `0,00%` when empty).
   - Ensure bracket displays `simples?.faixa_atual || 'Faixa 1 (Sem Faturamento)'`.
   - Ensure all metric cards (Saldo em Caixa, Contas a Pagar Hoje, Contas a Receber Hoje, Saldo Projetado) render strict `R$ 0,00` when values are 0 or undefined.
   - Handle empty cash flow forecast gracefully with clear empty state messaging.
2. In `client/src/components/portal/PortalTaxGuidesTab.tsx`:
   - Remove hardcoded mock static PIX string fallback (line 119). Use the dynamic `pix_copia_e_cola` from the API.
   - Remove hardcoded competency fallback `'08/2026'`.
   - Ensure empty guides state displays clean informational empty state: `"Nenhuma guia pendente encontrada."`
3. In `client/src/services/api.ts`:
   - Ensure `getPortalDashboardSummary` and `getPortalTaxGuides` query endpoints passing `company_id`.
4. Verify client builds with 0 errors (`npm run --prefix client build` or `cd client && npx tsc --noEmit`).
5. Document all changes and verification in `c:\Users\USER\Documents\app_xml_antigravity\.agents\worker_frontend_m3\handoff.md`. Send message when done.
