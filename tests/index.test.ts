import { describe, expect, test } from 'bun:test';
import { gattaiMerge } from '../src/index';

describe('gattaiMerge', () => {
  test('primitive values: target wins', () => {
    expect(gattaiMerge(1, 2)).toBe(1);
    expect(gattaiMerge('a', 'b')).toBe('a');
    expect(gattaiMerge(true, false)).toBe(true);
  });

  test('null/undefined source returns source', () => {
    expect(gattaiMerge(null, { a: 1 })).toBe(null);
    expect(gattaiMerge({ a: 1 }, null)).toBe(null);
    expect(gattaiMerge(undefined, { a: 1 })).toBe(undefined);
    expect(gattaiMerge({ a: 1 }, undefined)).toBe(undefined);
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
