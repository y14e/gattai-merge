/**
 * gattai-merge
 * High-performance deep merge utility with structural sharing.
 * Supports circular references and complex built-in types.
 *
 * @version 2.0.1
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) 2026 Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/gattai-merge}
 */

export interface GattaiMergeOptions {
  readonly arrays?: 'replace' | 'concat' | 'merge';
  readonly preserveDescriptors?: boolean;
}

type AnyObject = Record<PropertyKey, unknown>;

type PlainObject = Record<string, unknown>;

type DeepMergedObject<T extends object, S extends readonly unknown[]> = S extends readonly [infer F, ...infer R] ? (MergedObject<T, F> extends object ? DeepMergedObject<MergedObject<T, F>, R> : MergedObject<T, F>) : T;

type MergedObject<T, S> = [T, S] extends [readonly unknown[], readonly unknown[]] ? T | S : [T, S] extends [object, object] ? Omit<T, keyof S> & S : S;

type Ref = WeakMap<object, unknown>;

//
// [API]
//
export function gattaiMerge<T extends object, S extends readonly unknown[]>(target: T, ...args: S): DeepMergedObject<T, S>;
export function gattaiMerge<T extends object, S extends readonly unknown[]>(target: T, ...args: [...S, GattaiMergeOptions]): DeepMergedObject<T, S>;
export function gattaiMerge(target: unknown, ...args: unknown[]) {
  if (!isObject(target)) {
    return target;
  }
  if (Object.isFrozen(target)) {
    throw new TypeError('Target object frozen.');
  }

  const argsCopy = [...args] as unknown[];
  const last = argsCopy[argsCopy.length - 1];
  const hasOptions = isGattaiMergeOptions(last);
  const options: GattaiMergeOptions = hasOptions ? (argsCopy.pop() as GattaiMergeOptions) : {};
  const sources = argsCopy;

  const __ref__: Ref = new WeakMap();
  __ref__.set(target, target);

  let result: unknown = target;
  for (let i = 0, l = sources.length; i < l; i++) {
    result = dispatch(result, sources[i], options, __ref__);
  }
  return result;
}

//
// [Core] Dispatch
//
function dispatch<T, S>(target: T, source: S, options: GattaiMergeOptions, __ref__: Ref): T | S {
  if (Object.is(target, source)) {
    return target;
  }

  if (target == null) {
    return clone(source, options, __ref__);
  }
  if (source == null) {
    return source;
  }

  const targetIsObject = isObject(target);
  const sourceIsObject = isObject(source);
  if (!targetIsObject || !sourceIsObject) {
    return sourceIsObject ? clone(source, options, __ref__) : source;
  }

  // Circular ref: prevent infinite recursion
  if (__ref__.has(source)) {
    return __ref__.get(source) as S;
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    return mergeArray(target, source, options, __ref__) as T | S;
  }

  if (target instanceof Map && source instanceof Map) {
    return mergeMap(target, source, options, __ref__) as T | S;
  }

  if (target instanceof Set && source instanceof Set) {
    const result = new Set<unknown>();
    __ref__.set(source, result);
    for (const v of target) {
      result.add(clone(v, options, __ref__));
    }
    for (const v of source) {
      result.add(clone(v, options, __ref__));
    }
    return result as T | S;
  }

  if (isPlainObject(target) && isPlainObject(source)) {
    return options.preserveDescriptors ? (mergeObjectWithDescriptor(target, source, options, __ref__) as T | S) : (merge(target, source, options, __ref__) as T | S);
  }

  // Fallback: unmergeable types
  return clone(source, options, __ref__);
}

//
// [Core] Merge
//
const HAS_OWN = Object.prototype.hasOwnProperty;

function merge(target: PlainObject, source: PlainObject, options: GattaiMergeOptions, __ref__: Ref): PlainObject {
  __ref__.set(source, target);
  let result: PlainObject | null = null;

  for (const key of Reflect.ownKeys(source)) {
    if (isUnsafeKey(key)) continue;
    const sv = source[key as keyof typeof source];
    const tv = target[key as keyof typeof target];

    if (!(key in target)) {
      if (result === null) {
        result = Object.create(Object.getPrototypeOf(target)) as PlainObject;
        Object.assign(result, target);
        __ref__.set(source, result);
      }
      result[key as keyof PlainObject] = clone(sv, options, __ref__);
      continue;
    }

    const merged = dispatch(tv, sv, options, __ref__);
    if (!Object.is(merged, tv)) {
      if (result === null) {
        result = Object.create(Object.getPrototypeOf(target)) as PlainObject;
        Object.assign(result, target);
        __ref__.set(source, result);
      }
      result[key as keyof PlainObject] = merged;
    }
  }
  return result ?? target;
}

function mergeArray(target: readonly unknown[], source: readonly unknown[], options: GattaiMergeOptions, __ref__: Ref): unknown[] {
  const mode = options.arrays ?? 'replace';

  if (mode === 'replace') {
    return clone(source, options, __ref__) as unknown[];
  }

  __ref__.set(source, target);

  if (mode === 'concat') {
    const result = new Array(target.length + source.length);
    for (let i = 0; i < target.length; i++) {
      result[i] = target[i];
    }
    for (let i = 0; i < source.length; i++) {
      result[target.length + i] = clone(source[i], options, __ref__);
    }
    __ref__.set(source, result);
    return result;
  }

  let result: unknown[] | null = null;
  const max = Math.max(target.length, source.length);
  for (let i = 0; i < max; i++) {
    const tv = i < target.length ? target[i] : undefined;
    const sv = i < source.length ? source[i] : undefined;
    const hasSource = i < source.length;
    const hasTarget = i < target.length;
    if (!hasSource && hasTarget) {
      if (result === null) {
        result = [...target];
        __ref__.set(source, result);
      }
      result[i] = tv;
      continue;
    }
    const merged = !hasTarget ? clone(sv, options, __ref__) : dispatch(tv, sv, options, __ref__);
    if (!Object.is(merged, tv)) {
      if (result === null) {
        result = [...target];
        __ref__.set(source, result);
      }
      if (result.length <= i) {
        result.length = i + 1;
      }
      result[i] = merged;
    } else if (result !== null) {
      if (result.length <= i) {
        result.length = i + 1;
      }
      result[i] = tv;
    }
  }
  return result ?? (target as unknown[]);
}

function mergeMap<K, V>(target: ReadonlyMap<K, V>, source: ReadonlyMap<K, V>, options: GattaiMergeOptions, __ref__: Ref): Map<K, V> {
  __ref__.set(source, target);

  let result: Map<K, V> | null = null;
  for (const [k, v] of source) {
    if (!target.has(k)) {
      if (result === null) {
        result = new Map(target);
        __ref__.set(source, result);
      }
      result.set(k, clone(v, options, __ref__) as V);
      continue;
    }
    const tv = target.get(k) as V;
    const merged = dispatch(tv, v, options, __ref__) as V;
    if (!Object.is(merged, tv)) {
      if (result === null) {
        result = new Map(target);
        __ref__.set(source, result);
      }
      result.set(k, merged);
    }
  }
  return result ?? (target as Map<K, V>);
}

function mergeObjectWithDescriptor(target: AnyObject, source: AnyObject, options: GattaiMergeOptions, __ref__: Ref): AnyObject {
  const placeholder = Object.create(Object.getPrototypeOf(target));
  __ref__.set(source, placeholder);

  let result: AnyObject | null = null;

  const tDesc = Object.getOwnPropertyDescriptors(target);
  const sDesc = Object.getOwnPropertyDescriptors(source);

  for (const key of Reflect.ownKeys(sDesc)) {
    if (isUnsafeKey(key)) {
      continue;
    }

    const sd = sDesc[key as string | symbol];
    const td = tDesc[key as string | symbol];

    if ('value' in sd) {
      const tv = td && 'value' in td ? td.value : undefined;

      const merged = td === undefined || !('value' in td) ? clone(sd.value, options, __ref__) : dispatch(tv, sd.value, options, __ref__);

      if (!td || !('value' in td) || !Object.is(merged, td.value)) {
        result ??= cloneObjectWithDescriptors(target, options, __ref__);
        Object.defineProperty(result, key, { ...sd, value: merged });
      }
    } else if (!td) {
      result ??= cloneObjectWithDescriptors(target, options, __ref__);
      Object.defineProperty(result, key, sd);
    }
  }

  if (result === null) {
    __ref__.set(source, target);
    return target;
  }

  Object.defineProperties(placeholder, Object.getOwnPropertyDescriptors(result));
  return placeholder;
}

//
// [Core] Clone
//
function clone<T>(value: T, options: GattaiMergeOptions, __ref__: Ref): T {
  if (!isObject(value)) {
    return value;
  }

  // Circular ref: prevent infinite recursion
  if (__ref__.has(value)) {
    return __ref__.get(value) as T;
  }

  if (isPlainObject(value)) {
    const result = Object.create(Object.getPrototypeOf(value)) as PlainObject;
    __ref__.set(value, result);
    for (const key in value) {
      if (!HAS_OWN.call(value, key) || isUnsafeKey(key)) {
        continue;
      }
      result[key] = clone(value[key], options, __ref__);
    }
    return result as T;
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    __ref__.set(value, result);
    for (let i = 0, l = value.length; i < l; i++) {
      result[i] = clone(value[i], options, __ref__);
    }
    return result as T;
  }

  if (value instanceof Date) {
    const result = new Date(value.getTime());
    __ref__.set(value, result);
    return result as T;
  }

  if (value instanceof RegExp) {
    const result = new RegExp(value.source, value.flags);
    __ref__.set(value, result);
    return result as T;
  }

  if (ArrayBuffer.isView(value)) {
    const Ctor = value.constructor as new (arg: typeof value) => typeof value;
    const result = new Ctor(value);
    __ref__.set(value, result);
    return result as T;
  }
  if (value instanceof ArrayBuffer) {
    const result = value.slice(0);
    __ref__.set(value, result);
    return result as T;
  }

  if (value instanceof Error || value instanceof DOMException) {
    const Ctor = value.constructor as new (message?: string) => Error;
    const result = new Ctor(value.message);
    __ref__.set(value, result);
    result.name = value.name;
    result.stack = value.stack;
    if ('cause' in value) {
      result.cause = clone(value.cause, options, __ref__);
    }
    for (const [k, v] of Object.entries(value)) {
      Object.defineProperty(result, k, {
        configurable: true,
        enumerable: true,
        value: clone(v, options, __ref__),
        writable: true,
      });
    }
    return result as T;
  }

  if (value instanceof Blob) {
    const result = value.slice(0, value.size, value.type);
    __ref__.set(value, result);
    return result as T;
  }

  if (typeof ImageData !== 'undefined' && value instanceof ImageData) {
    const result = new ImageData(new Uint8ClampedArray(value.data), value.width, value.height);
    __ref__.set(value, result);
    return result as T;
  }

  if (value instanceof Map) {
    const result = new Map();
    __ref__.set(value, result);
    for (const [k, v] of value) {
      result.set(k, clone(v, options, __ref__));
    }
    return result as T;
  }

  if (value instanceof Set) {
    const result = new Set();
    __ref__.set(value, result);
    for (const v of value) {
      result.add(clone(v, options, __ref__));
    }
    return result as T;
  }

  if (options.preserveDescriptors) {
    return cloneObjectWithDescriptors(value as AnyObject, options, __ref__) as T;
  }

  // Fallback: unsupported types
  __ref__.set(value, value);
  return value;
}

function cloneObjectWithDescriptors(obj: AnyObject, options: GattaiMergeOptions, __ref__: Ref): AnyObject {
  const result = Object.create(Object.getPrototypeOf(obj)) as AnyObject;
  __ref__.set(obj, result);

  const descriptors = Object.getOwnPropertyDescriptors(obj);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (isUnsafeKey(key)) {
      continue;
    }
    const descriptor = descriptors[key as string | symbol];
    if ('value' in descriptor) {
      descriptor.value = clone(descriptor.value, options, __ref__);
    }
    Object.defineProperty(result, key, descriptor);
  }
  return result;
}

//
// Utils
//
const OBJECT_TO_STRING = Object.prototype.toString;

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isPlainObject(value: unknown): value is PlainObject {
  return OBJECT_TO_STRING.call(value) === '[object Object]';
}

function isUnsafeKey(key: PropertyKey): boolean {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

function isGattaiMergeOptions(value: unknown): value is GattaiMergeOptions {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return true;
  return keys.every((k) => k === 'arrays' || k === 'preserveDescriptors');
}
