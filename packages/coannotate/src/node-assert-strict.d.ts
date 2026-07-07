declare module 'node:assert/strict' {
  interface StrictAssert {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
    match(actual: string, expected: RegExp, message?: string): void;
  }

  const assert: StrictAssert;
  export default assert;
}
