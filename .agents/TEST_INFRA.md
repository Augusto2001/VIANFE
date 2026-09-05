# E2E Test Infra: Viacont Super App / Client Portal

## Test Philosophy
- Opaque-box, requirement-driven, deterministic verification.
- Zero mock fallback validation (verifying true 0.00 for empty companies).
- Strict multi-tenant isolation verification (verifying Company A cannot view Company B's data).
- EMV BR Code PIX mathematical CRC16-CCITT validation.

## Feature Inventory & Test Mapping
| # | Feature | Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Scenario) |
|---|---------|--------|:----------------:|:-----------------:|:----------------------:|:-----------------:|
| 1 | Real-Time Bank Balance | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| 2 | Real-Time Receivables | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| 3 | Real-Time Payables | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| 4 | Simples Nacional RBT12 | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| 5 | Route Aliasing | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| 6 | Dynamic Tax Guides | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| 7 | Dynamic Real PIX | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| 8 | Zero Mock Fallback | ORIGINAL_REQUEST §1,3 | 5 | 5 | ✓ | ✓ |
| 9 | Strict Multi-Tenant Isolation | ORIGINAL_REQUEST §4 | 5 | 5 | ✓ | ✓ |
| 10| TypeScript 0 Errors | ORIGINAL_REQUEST §4 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Master Runner: `node tests/e2e/test_runner.js`
- Test Suites:
  - `tests/e2e/integration_api.test.js` (Multi-tenant isolation, real metrics, dynamic tax guides, PIX CRC16, zero fallback)
  - `tests/e2e/tier1_feature.js` (Feature coverage tests)
  - `tests/e2e/tier2_boundary.js` (Boundary & edge cases: R$ 3.6M subteto, R$ 4.8M teto, empty company, leap year, large amounts)
  - `tests/e2e/tier3_combinations.js` (Pairwise combinations: BPO provisions + invoices + bank transactions)
  - `tests/e2e/tier4_scenarios.js` (Full end-to-end client portal workflows)
- Pass/Fail semantics: All assertions must pass, exit code 0.
