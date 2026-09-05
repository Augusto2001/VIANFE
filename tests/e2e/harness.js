/**
 * E2E Test Harness & Assertion Utilities
 * Super App Viacont (Área do Cliente & BPO Financeiro)
 * Deterministic Test Framework for Multi-Tenant Isolation & Financial Calculations
 */

export class AssertionError extends Error {
  constructor(message, expected, actual) {
    super(message);
    this.name = 'AssertionError';
    this.expected = expected;
    this.actual = actual;
  }
}

export const assert = {
  strictEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(expected)} (type: ${typeof expected}) but got ${JSON.stringify(actual)} (type: ${typeof actual})`,
        expected,
        actual
      );
    }
  },

  notStrictEqual(actual, expected, message) {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected value not to strictly equal ${JSON.stringify(expected)}`,
        `not ${expected}`,
        actual
      );
    }
  },

  deepStrictEqual(actual, expected, message) {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      throw new AssertionError(
        message || `Deep strict equality failed:\nExpected: ${expStr}\nActual:   ${actStr}`,
        expected,
        actual
      );
    }
  },

  ok(value, message) {
    if (!value) {
      throw new AssertionError(message || `Expected truthy value but got ${JSON.stringify(value)}`, true, value);
    }
  },

  match(string, regex, message) {
    if (!regex.test(String(string))) {
      throw new AssertionError(
        message || `Expected "${string}" to match regex ${regex}`,
        regex.toString(),
        string
      );
    }
  },

  doesNotMatch(string, regex, message) {
    if (regex.test(String(string))) {
      throw new AssertionError(
        message || `Expected "${string}" NOT to match regex ${regex}`,
        `not match ${regex}`,
        string
      );
    }
  },

  approximatelyEqual(actual, expected, tolerance = 0.01, message) {
    const diff = Math.abs(Number(actual) - Number(expected));
    if (diff > tolerance) {
      throw new AssertionError(
        message || `Expected ${actual} to be approximately equal to ${expected} (diff: ${diff.toFixed(4)} > tolerance: ${tolerance})`,
        expected,
        actual
      );
    }
  },

  throws(fn, expectedRegexOrType, message) {
    let threw = false;
    let thrownError = null;
    try {
      fn();
    } catch (err) {
      threw = true;
      thrownError = err;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected function to throw an error, but it did not', 'Exception', 'No exception');
    }
    if (expectedRegexOrType instanceof RegExp) {
      if (!expectedRegexOrType.test(thrownError.message)) {
        throw new AssertionError(
          `Thrown error "${thrownError.message}" did not match regex ${expectedRegexOrType}`,
          expectedRegexOrType.toString(),
          thrownError.message
        );
      }
    }
  },

  async rejects(asyncFn, expectedRegexOrType, message) {
    let threw = false;
    let thrownError = null;
    try {
      await asyncFn();
    } catch (err) {
      threw = true;
      thrownError = err;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected async function to reject, but it did not', 'Rejection', 'Resolved');
    }
    if (expectedRegexOrType instanceof RegExp) {
      if (!expectedRegexOrType.test(thrownError.message)) {
        throw new AssertionError(
          `Thrown error "${thrownError.message}" did not match regex ${expectedRegexOrType}`,
          expectedRegexOrType.toString(),
          thrownError.message
        );
      }
    }
  }
};

// ANSI color helpers
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgBlue: '\x1b[44m'
};

export class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
  }

  add(id, name, fn) {
    this.tests.push({ id, name, fn });
  }

  async run(reporter) {
    reporter.startSuite(this.name, this.tests.length);
    const results = [];

    for (const test of this.tests) {
      const startTime = Date.now();
      try {
        await test.fn();
        const duration = Date.now() - startTime;
        const result = { id: test.id, name: test.name, status: 'pass', duration };
        results.push(result);
        reporter.passTest(test.id, test.name, duration);
      } catch (err) {
        const duration = Date.now() - startTime;
        const result = { id: test.id, name: test.name, status: 'fail', duration, error: err };
        results.push(result);
        reporter.failTest(test.id, test.name, duration, err);
      }
    }

    reporter.endSuite(this.name, results);
    return results;
  }
}
