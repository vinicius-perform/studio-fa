import { describe, it, test, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert';

const beforeAll = before;
const afterAll = after;

function createExpect(actual: any, isNot = false): any {
  return {
    get not() {
      return createExpect(actual, !isNot);
    },
    toBe(expected: any) {
      if (isNot) {
        assert.notStrictEqual(actual, expected);
      } else {
        assert.strictEqual(actual, expected);
      }
    },
    toEqual(expected: any) {
      if (isNot) {
        assert.notDeepStrictEqual(actual, expected);
      } else {
        assert.deepStrictEqual(actual, expected);
      }
    },
    toBeDefined() {
      if (isNot) {
        assert.strictEqual(actual, undefined);
      } else {
        assert.notStrictEqual(actual, undefined);
      }
    },
    toBeUndefined() {
      if (isNot) {
        assert.notStrictEqual(actual, undefined);
      } else {
        assert.strictEqual(actual, undefined);
      }
    },
    toBeNull() {
      if (isNot) {
        assert.notStrictEqual(actual, null);
      } else {
        assert.strictEqual(actual, null);
      }
    },
    toContain(item: any) {
      if (typeof actual === 'string') {
        const contains = actual.includes(item);
        if (isNot) {
          assert.strictEqual(contains, false, `Expected "${actual}" not to contain "${item}"`);
        } else {
          assert.strictEqual(contains, true, `Expected "${actual}" to contain "${item}"`);
        }
      } else if (Array.isArray(actual)) {
        const contains = actual.includes(item);
        if (isNot) {
          assert.strictEqual(contains, false, `Expected array not to contain ${item}`);
        } else {
          assert.strictEqual(contains, true, `Expected array to contain ${item}`);
        }
      } else if (actual && typeof actual === 'object') {
        const contains = item in actual;
        if (isNot) {
          assert.strictEqual(contains, false);
        } else {
          assert.strictEqual(contains, true);
        }
      }
    },
    toBeLessThan(expected: number) {
      if (isNot) {
        assert.ok(actual >= expected, `Expected ${actual} not to be less than ${expected}`);
      } else {
        assert.ok(actual < expected, `Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (isNot) {
        assert.ok(actual <= expected, `Expected ${actual} not to be greater than ${expected}`);
      } else {
        assert.ok(actual > expected, `Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (isNot) {
        assert.ok(actual < expected, `Expected ${actual} not to be >= ${expected}`);
      } else {
        assert.ok(actual >= expected, `Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeInstanceOf(expectedClass: any) {
      if (isNot) {
        assert.ok(!(actual instanceof expectedClass));
      } else {
        assert.ok(actual instanceof expectedClass);
      }
    },
    toBeTruthy() {
      if (isNot) {
        assert.ok(!actual);
      } else {
        assert.ok(actual);
      }
    },
    toBeFalsy() {
      if (isNot) {
        assert.ok(actual);
      } else {
        assert.ok(!actual);
      }
    },
    toThrow(expectedError?: any) {
      if (typeof actual !== 'function') {
        throw new Error('toThrow requires a function to be tested');
      }
      if (isNot) {
        assert.doesNotThrow(actual);
      } else {
        assert.throws(actual, expectedError);
      }
    },
    toMatch(regex: RegExp) {
      if (isNot) {
        assert.ok(!regex.test(String(actual)));
      } else {
        assert.ok(regex.test(String(actual)));
      }
    },
  };
}

export const expect = (actual: any) => createExpect(actual);
export { describe, it, test, beforeEach, afterEach, beforeAll, afterAll };
