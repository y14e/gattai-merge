import { describe, expect, test } from 'bun:test';
import gattaiMerge from '../src/index';

describe('gattaiMerge', () => {
  test('primitive values: source wins', () => {
    expect(gattaiMerge(1, 2)).toBe(2);
    expect(gattaiMerge('a', 'b')).toBe('b');
    expect(gattaiMerge(true, false)).toBe(false);
  });

  test('nullish source: loose mode keeps target', () => {
    expect(gattaiMerge({ a: 1 }, null)).toEqual({ a: 1 });
    expect(gattaiMerge({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  test('nullish source: strict mode returns source', () => {
    expect(gattaiMerge({ a: 1 }, null, { nullish: 'strict' })).toBe(null);
    expect(gattaiMerge({ a: 1 }, undefined, { nullish: 'strict' })).toBe(
      undefined,
    );
  });

  test('nullish source: throw mode throws', () => {
    expect(() => gattaiMerge({ a: 1 }, null, { nullish: 'throw' })).toThrow(
      TypeError,
    );
  });

  test('nullish target: clones source', () => {
    const source = { a: 1 };
    const result = gattaiMerge(null, source);
    expect(result).toEqual({ a: 1 });
    expect(result).not.toBe(source);

    expect(gattaiMerge(undefined, source)).toEqual({ a: 1 });
  });

  test('shallow merge objects', () => {
    const result = gattaiMerge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('deep merge objects', () => {
    const target = { a: { b: 1 } };
    const source = { a: { c: 2 } };
    expect(gattaiMerge(target, source)).toEqual({ a: { b: 1, c: 2 } });
  });

  test('structural sharing: unchanged props keep reference', () => {
    const nested = { x: 1 };
    const target = { a: nested, b: 1 };
    const result = gattaiMerge(target, { b: 2 });
    expect(result.a).toBe(nested);
    expect(result.b).toBe(2);
  });

  test('arrays: replace by default', () => {
    expect(gattaiMerge([1, 2], [3])).toEqual([3]);
  });

  test('arrays: concat', () => {
    const result = gattaiMerge([1, 2], [3, 4], { arrays: 'concat' });
    expect(result).toEqual([1, 2, 3, 4]);
  });

  test('arrays: merge by index', () => {
    const target = [{ a: 1 }, { b: 2 }];
    const source = [{ c: 3 }, { d: 4 }];
    const result = gattaiMerge(target, source, { arrays: 'merge' });
    expect(result).toEqual([
      { a: 1, c: 3 },
      { b: 2, d: 4 },
    ]);
  });

  test('arrays: merge with nullish loose', () => {
    const result = gattaiMerge([1, 2], [null, 4], { arrays: 'merge' });
    expect(result).toEqual([1, 4]);
  });

  test('arrays: merge with nullish strict', () => {
    const result = gattaiMerge([1, 2], [null, 4], {
      arrays: 'merge',
      nullish: 'strict',
    });
    expect(result).toEqual([null, 4]);
  });

  test('circular reference', () => {
    const a: any = { x: 1 };
    a.self = a;
    const b: any = { y: 2 };
    b.self = b;

    const result = gattaiMerge(a, b) as any;
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
    expect(result.self).toBe(result);
    expect(result.self.x).toBe(1);
  });

  test('multiple sources', () => {
    const result = gattaiMerge({ a: 1 }, { b: 2 }, { c: 3 });
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('frozen target throws', () => {
    const frozen = Object.freeze({ a: 1 });
    expect(() => gattaiMerge(frozen, { b: 2 })).toThrow(TypeError);
  });

  test('descriptors: preserve getter/setter', () => {
    const source = {};
    Object.defineProperty(source, 'x', {
      get: () => 42,
      enumerable: true,
    });
    const result = gattaiMerge({}, source, { preserveDescriptors: true });
    expect(result.x).toBe(42);
    expect(Object.getOwnPropertyDescriptor(result, 'x')?.get).toBeDefined();
  });

  test('unmergeable types: source is cloned', () => {
    const date = new Date('2024-01-01');
    const regexp = /test/;
    const result = gattaiMerge(date, regexp);
    expect(result).toBeInstanceOf(RegExp);
    expect(result.source).toBe('test');
    expect(result).not.toBe(regexp);
  });
});
