/**
 * gattai-merge
 * High-performance deep merge utility with structural sharing.
 * Supports circular ref and complex built-in types.
 *
 * @version 3.0.3
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) 2026 Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/gattai-merge}
 */

export interface GattaiMergeOptions {
  readonly arrays?: 'replace' | 'concat' | 'merge';
  readonly nullish?: 'loose' | 'strict' | 'throw';
  readonly preserveDescriptors?: boolean;
}

type O = GattaiMergeOptions;

type AnyObject = Record<PropertyKey, unknown>;

type PlainObject = Record<string, unknown>;

type DeepMergedObject<
  T extends object,
  S extends readonly unknown[],
> = S extends readonly [infer F, ...infer R]
  ? MergedObject<T, F> extends object
    ? DeepMergedObject<MergedObject<T, F>, R>
    : MergedObject<T, F>
  : T;

type MergedObject<T, S> = [T, S] extends [
  readonly unknown[],
  readonly unknown[],
]
  ? T | S
  : [T, S] extends [object, object]
    ? Omit<T, keyof S> & S
    : S;

type Ref = WeakMap<object, unknown>;

//
// [API]
//

const EMPTY_OPTIONS: O = {};

export default function gattaiMerge<
  T extends object,
  S extends readonly unknown[],
>(target: T, ...args: S): DeepMergedObject<T, S>;
export default function gattaiMerge<
  T extends object,
  S extends readonly unknown[],
>(target: T, ...args: [...S, O]): DeepMergedObject<T, S>;
export default function gattaiMerge(target: unknown, ...args: unknown[]) {
  const length = args.length;
  const last = length > 0 ? args[length - 1] : undefined;
  const hasOptions = isGattaiMergeOptions(last);
  const options = hasOptions ? (last as O) : EMPTY_OPTIONS;
  let result: unknown = target;

  for (let i = 0, l = hasOptions ? length - 1 : length; i < l; i++) {
    result = dispatch(result, args[i], options, new WeakMap());
  }

  return result;
}

//
// [Dispatch]
//

function dispatch<T, S>(target: T, source: S, options: O, ref: Ref): T | S {
  if (isSame(target, source)) {
    return target;
  }

  // Nullish
  if (source == null) {
    const nullish = options.nullish ?? 'loose';

    if (nullish === 'strict') {
      return source as S;
    }

    if (nullish === 'throw') {
      throw new TypeError('Source object nullish.');
    }

    return target;
  }

  if (target == null) {
    return clone(source, options, ref);
  }

  const targetIsObject = isObject(target);
  const sourceIsObject = isObject(source);

  if (!targetIsObject || !sourceIsObject) {
    return sourceIsObject ? clone(source, options, ref) : source;
  }

  if (Object.isFrozen(target)) {
    throw new TypeError('Target object frozen.');
  }

  // Circular ref: prevent infinite recursion
  const cached = ref.get(source);

  if (cached !== undefined) {
    return cached as S;
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    return mergeArray(target, source, options, ref) as T | S;
  }

  if (target instanceof Map && source instanceof Map) {
    return mergeMap(target, source, options, ref) as T | S;
  }

  if (target instanceof Set && source instanceof Set) {
    const result = new Set<unknown>();

    ref.set(source, result);

    for (const v of target) {
      result.add(clone(v, options, ref));
    }

    for (const v of source) {
      result.add(clone(v, options, ref));
    }

    return result as T | S;
  }

  if (isPlainObject(target) && isPlainObject(source)) {
    return options.preserveDescriptors
      ? (mergeWithDescriptor(target, source, options, ref) as T | S)
      : (merge(target, source, options, ref) as T | S);
  }

  // Fallback: unmergeable types
  return clone(source, options, ref);
}

//
// [Merge]
//

const HAS_OWN = Object.prototype.hasOwnProperty;

function merge(
  target: PlainObject,
  source: PlainObject,
  options: O,
  ref: Ref,
): PlainObject {
  ref.set(source, target);

  let result: PlainObject | null = null;
  const sourceKeys = Reflect.ownKeys(source);
  const proto = Object.getPrototypeOf(target);
  let targetKeys: string[] | null = null;

  for (let i = 0, l = sourceKeys.length; i < l; i++) {
    const key = sourceKeys[i];

    if (isUnsafeKey(key)) {
      continue;
    }

    const sourceValue = source[key as keyof typeof source];
    const targetValue = target[key as keyof typeof target];

    if (!HAS_OWN.call(target, key)) {
      if (result === null) {
        result = Object.create(proto) as PlainObject;
        targetKeys ??= Object.keys(target);

        for (let j = 0, m = targetKeys.length; j < m; j++) {
          const k = targetKeys[j];
          result[k] = target[k];
        }

        ref.set(source, result);
      }

      result[key as keyof PlainObject] = clone(sourceValue, options, ref);
      continue;
    }

    const mergedValue = dispatch(targetValue, sourceValue, options, ref);

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = Object.create(proto) as PlainObject;
        targetKeys ??= Object.keys(target);

        for (let j = 0, m = targetKeys.length; j < m; j++) {
          const k = targetKeys[j];
          result[k] = target[k];
        }

        ref.set(source, result);
      }

      result[key as keyof PlainObject] = mergedValue;
    }
  }

  return result ?? target;
}

function mergeArray(
  target: readonly unknown[],
  source: readonly unknown[],
  options: O,
  ref: Ref,
): unknown[] {
  const arrays = options.arrays ?? 'replace';

  if (arrays === 'replace') {
    return clone(source, options, ref) as unknown[];
  }

  ref.set(source, target);

  if (arrays === 'concat') {
    const result = new Array(target.length + source.length);

    for (let i = 0, l = target.length; i < l; i++) {
      result[i] = target[i];
    }

    for (let i = 0, l = source.length; i < l; i++) {
      result[target.length + i] = clone(source[i], options, ref);
    }

    ref.set(source, result);

    return result;
  }

  // arrays === 'merge'
  const max = Math.max(target.length, source.length);
  const nullish = options.nullish ?? 'loose';
  let result: unknown[] | null = null;

  for (let i = 0; i < max; i++) {
    const hasTarget = i < target.length;
    const hasSource = i < source.length;
    const targetValue = hasTarget ? target[i] : undefined;
    const sourceValue = hasSource ? source[i] : undefined;

    if (hasSource && sourceValue == null && nullish === 'loose') {
      if (hasTarget) {
        if (result === null) {
          result = [...target];

          ref.set(source, result);
        }

        continue;
      }

      continue;
    }

    if (!hasSource && hasTarget) {
      if (result === null) {
        result = [...target];

        ref.set(source, result);
      }

      result[i] = targetValue;
      continue;
    }

    const mergedValue = !hasTarget
      ? clone(sourceValue, options, ref)
      : dispatch(targetValue, sourceValue, options, ref);

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = [...target];

        ref.set(source, result);
      }

      if (result.length <= i) {
        result.length = i + 1;
      }

      result[i] = mergedValue;
    } else if (result !== null) {
      if (result.length <= i) {
        result.length = i + 1;
      }

      result[i] = targetValue;
    }
  }

  return result ?? (target as unknown[]);
}

function mergeMap<K, V>(
  target: ReadonlyMap<K, V>,
  source: ReadonlyMap<K, V>,
  options: O,
  ref: Ref,
): Map<K, V> {
  ref.set(source, target);

  let result: Map<K, V> | null = null;

  for (const [key, sourceValue] of source) {
    if (!target.has(key)) {
      if (result === null) {
        result = new Map(target);

        ref.set(source, result);
      }

      result.set(key, clone(sourceValue, options, ref) as V);

      continue;
    }

    const targetValue = target.get(key) as V;
    const mergedValue = dispatch(targetValue, sourceValue, options, ref) as V;

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = new Map(target);

        ref.set(source, result);
      }

      result.set(key, mergedValue);
    }
  }

  return result ?? (target as Map<K, V>);
}

function mergeWithDescriptor(
  target: AnyObject,
  source: AnyObject,
  options: O,
  ref: Ref,
): AnyObject {
  const placeholder = Object.create(Object.getPrototypeOf(target));

  ref.set(source, placeholder);

  let result: AnyObject | null = null;
  const targetDescs = Object.getOwnPropertyDescriptors(target);
  const sourceDescs = Object.getOwnPropertyDescriptors(source);
  const keys = Reflect.ownKeys(sourceDescs);

  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];

    if (isUnsafeKey(key)) {
      continue;
    }

    const targetDesc = targetDescs[key as string | symbol];
    const sourceDesc = sourceDescs[key as string | symbol];

    if ('value' in sourceDesc) {
      const targetValue =
        targetDesc && 'value' in targetDesc ? targetDesc.value : undefined;
      const mergedValue =
        targetDesc === undefined || !('value' in targetDesc)
          ? clone(sourceDesc.value, options, ref)
          : dispatch(targetValue, sourceDesc.value, options, ref);

      if (
        !targetDesc ||
        !('value' in targetDesc) ||
        !isSame(mergedValue, targetDesc.value)
      ) {
        result ??= cloneWithDescriptors(target, options, ref);
        Object.defineProperty(result, key, {
          ...sourceDesc,
          value: mergedValue,
        });
      }
    } else if (!targetDesc) {
      result ??= cloneWithDescriptors(target, options, ref);
      Object.defineProperty(result, key, sourceDesc);
    }
  }

  if (result === null) {
    ref.set(source, target);

    return target;
  }

  Object.defineProperties(
    placeholder,
    Object.getOwnPropertyDescriptors(result),
  );

  return placeholder;
}

//
// [Clone]
//

function clone<T>(value: T, options: O, ref: Ref): T {
  if (!isObject(value)) {
    return value;
  }

  // Circular ref: prevent infinite recursion
  const cached = ref.get(value);

  if (cached !== undefined) {
    return cached as T;
  }

  if (isPlainObject(value)) {
    const result = Object.create(Object.getPrototypeOf(value)) as PlainObject;

    ref.set(value, result);

    for (const key in value) {
      if (!HAS_OWN.call(value, key) || isUnsafeKey(key)) {
        continue;
      }

      result[key] = clone(value[key], options, ref);
    }

    return result as T;
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];

    ref.set(value, result);

    for (let i = 0, l = value.length; i < l; i++) {
      result[i] = clone(value[i], options, ref);
    }

    return result as T;
  }

  if (value instanceof Date) {
    const result = new Date(value.getTime());

    ref.set(value, result);

    return result as T;
  }

  if (value instanceof RegExp) {
    const result = new RegExp(value.source, value.flags);

    ref.set(value, result);

    return result as T;
  }

  if (ArrayBuffer.isView(value)) {
    const Ctor = value.constructor as new (arg: typeof value) => typeof value;
    const result = new Ctor(value);

    ref.set(value, result);

    return result as T;
  }

  if (value instanceof ArrayBuffer) {
    const result = value.slice(0);

    ref.set(value, result);

    return result as T;
  }

  if (value instanceof Error || value instanceof DOMException) {
    const Ctor = value.constructor as new (message?: string) => Error;
    const result = new Ctor(value.message);

    ref.set(value, result);

    result.name = value.name;
    result.stack = value.stack;

    if ('cause' in value) {
      result.cause = clone(value.cause, options, ref);
    }

    for (const [key, v] of Object.entries(value)) {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: clone(v, options, ref),
        writable: true,
      });
    }

    return result as T;
  }

  if (value instanceof Blob) {
    const result = value.slice(0, value.size, value.type);

    ref.set(value, result);

    return result as T;
  }

  if (typeof ImageData !== 'undefined' && value instanceof ImageData) {
    const result = new ImageData(
      new Uint8ClampedArray(value.data),
      value.width,
      value.height,
    );

    ref.set(value, result);

    return result as T;
  }

  if (value instanceof Map) {
    const result = new Map();

    ref.set(value, result);

    for (const [key, v] of value) {
      result.set(key, clone(v, options, ref));
    }

    return result as T;
  }

  if (value instanceof Set) {
    const result = new Set();

    ref.set(value, result);

    for (const v of value) {
      result.add(clone(v, options, ref));
    }

    return result as T;
  }

  if (options.preserveDescriptors) {
    return cloneWithDescriptors(value as AnyObject, options, ref) as T;
  }

  // Fallback: unsupported types
  ref.set(value, value);

  return value;
}

function cloneWithDescriptors(
  value: AnyObject,
  options: O,
  ref: Ref,
): AnyObject {
  const result = Object.create(Object.getPrototypeOf(value)) as AnyObject;

  ref.set(value, result);

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);

  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];

    if (isUnsafeKey(key)) {
      continue;
    }

    const descriptor = descriptors[key as string | symbol];

    if ('value' in descriptor) {
      descriptor.value = clone(descriptor.value, options, ref);
    }

    Object.defineProperty(result, key, descriptor);
  }

  return result;
}

//
// [Utils]
//

function isGattaiMergeOptions(value: unknown): value is O {
  if (!isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (keys.length === 0) {
    return true;
  }

  return keys.every((key) => {
    return (
      key === 'arrays' || key === 'nullish' || key === 'preserveDescriptors'
    );
  });
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

const OBJECT_TO_STRING = Object.prototype.toString;

function isPlainObject(value: unknown): value is PlainObject {
  return OBJECT_TO_STRING.call(value) === '[object Object]';
}

function isSame(a: unknown, b: unknown): boolean {
  // biome-ignore lint/suspicious/noSelfCompare: performance optimization
  return a === b || (a !== a && b !== b);
}

function isUnsafeKey(key: PropertyKey): boolean {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}
