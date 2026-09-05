#!/usr/bin/env node

/**
 * Super App Viacont (Área do Cliente & BPO Financeiro)
 * Master Automated E2E Test Runner (Tiers 1 - 4 & Integration API)
 * 
 * Invocation: `node tests/e2e/test_runner.js`
 * Covers all 75+ test cases across Tiers 1-4 and Pillars 1-5
 */

import { colors } from './harness.js';
import { createTier1Suite } from './tier1_feature.js';
import { createTier2Suite } from './tier2_boundary.js';
import { createTier3Suite } from './tier3_combinations.js';
import { createTier4Suite } from './tier4_scenarios.js';
import { createIntegrationApiSuite } from './integration_api.test.js';

class TerminalReporter {
  constructor() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.suiteStats = [];
  }

  printHeader() {
    console.log('');
    console.log(`${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.white}  SUPER APP VIACONT (ÁREA DO CLIENTE) - AUTOMATED E2E TEST RUNNER${colors.reset}`);
    console.log(`${colors.dim}  Framework: Standalone Opaque-Box E2E Matrix (Tiers 1 - 4 + Integration)${colors.reset}`);
    console.log(`${colors.dim}  Timestamp: ${new Date().toISOString()}${colors.reset}`);
    console.log(`${colors.cyan}======================================================================${colors.reset}`);
    console.log('');
  }

  startSuite(name, count) {
    console.log(`${colors.bold}${colors.blue}▶ SUITE:${colors.reset} ${colors.bold}${name}${colors.reset} ${colors.dim}(${count} tests)${colors.reset}`);
  }

  passTest(id, name, duration) {
    this.totalTests++;
    this.passedTests++;
    const durStr = duration > 50 ? `${colors.yellow}${duration}ms${colors.reset}` : `${colors.dim}${duration}ms${colors.reset}`;
    console.log(`  ${colors.green}✓ PASS${colors.reset} ${colors.bold}[${id}]${colors.reset} ${name} ${durStr}`);
  }

  failTest(id, name, duration, error) {
    this.totalTests++;
    this.failedTests++;
    console.log(`  ${colors.red}✗ FAIL${colors.reset} ${colors.bold}[${id}]${colors.reset} ${name} ${colors.red}(${duration}ms)${colors.reset}`);
    console.log(`    ${colors.red}Error:${colors.reset} ${error.message}`);
    if (error.stack) {
      const filteredStack = error.stack.split('\n').slice(1, 4).join('\n    ');
      console.log(`    ${colors.dim}${filteredStack}${colors.reset}`);
    }
  }

  endSuite(name, results) {
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const total = results.length;
    this.suiteStats.push({ name, total, passed, failed });
    console.log(`${colors.dim}  └─────────────────────────────────────────────────────────────${colors.reset}`);
    console.log('');
  }

  printSummary(totalDuration) {
    console.log(`${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.white}                    COVERAGE BREAKDOWN MATRIX                        ${colors.reset}`);
    console.log(`${colors.cyan}======================================================================${colors.reset}`);
    console.log(` ${colors.bold}${'Suite / Tier'.padEnd(48)} ${'Tests'.padStart(7)} ${'Pass'.padStart(7)} ${'Fail'.padStart(7)}${colors.reset}`);
    console.log(` ${'-'.repeat(48)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(7)}`);

    for (const stat of this.suiteStats) {
      const passColor = stat.passed === stat.total ? colors.green : colors.yellow;
      const failColor = stat.failed > 0 ? colors.red : colors.dim;
      console.log(
        ` ${stat.name.padEnd(48)} ${String(stat.total).padStart(7)} ${passColor}${String(stat.passed).padStart(7)}${colors.reset} ${failColor}${String(stat.failed).padStart(7)}${colors.reset}`
      );
    }

    console.log(` ${'-'.repeat(48)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(7)}`);
    console.log(
      ` ${colors.bold}${'TOTAL'.padEnd(48)} ${String(this.totalTests).padStart(7)} ${colors.green}${String(this.passedTests).padStart(7)}${colors.reset} ${this.failedTests > 0 ? colors.red : colors.green}${String(this.failedTests).padStart(7)}${colors.reset}`
    );
    console.log(`${colors.cyan}======================================================================${colors.reset}`);
    console.log('');

    if (this.failedTests === 0) {
      console.log(`${colors.bgGreen}${colors.bold}${colors.white} ✓ ALL ${this.totalTests} E2E TESTS PASSED SUCCESSFULLY! (${(totalDuration / 1000).toFixed(2)}s) ${colors.reset}`);
      console.log(`${colors.green}  Super App Viacont meets 100% of Acceptance Criteria (R1 - R4).${colors.reset}`);
    } else {
      console.log(`${colors.bgRed}${colors.bold}${colors.white} ✗ ${this.failedTests} TEST(S) FAILED (${(totalDuration / 1000).toFixed(2)}s) ${colors.reset}`);
    }
    console.log('');
  }
}

export async function runAllTests() {
  const reporter = new TerminalReporter();
  reporter.printHeader();

  const suites = [
    createTier1Suite(),
    createTier2Suite(),
    createTier3Suite(),
    createTier4Suite(),
    createIntegrationApiSuite()
  ];

  const overallStartTime = Date.now();

  for (const suite of suites) {
    await suite.run(reporter);
  }

  const totalDuration = Date.now() - overallStartTime;
  reporter.printSummary(totalDuration);

  const exitCode = reporter.failedTests === 0 ? 0 : 1;
  return { exitCode, totalTests: reporter.totalTests, passed: reporter.passedTests, failed: reporter.failedTests };
}

// Direct CLI Execution
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('test_runner.js')) {
  runAllTests().then(({ exitCode }) => {
    process.exit(exitCode);
  }).catch(err => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
}
