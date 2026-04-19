/**
 * gattai-merge
 * High-performance deep merge utility with structural sharing.
 * Supports circular ref and complex built-in types.
 *
 * @version 3.0.8
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) 2026 Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/gattai-merge}
 */

export interface GattaiMergeOptions {
  readonly arrays?: 'replace' | 'concat' | 'merge';
  readonly nullish?: 'loose' | 'strict' | 'throw';
  readonly preserveDescriptors?: boolean;
  readonly strictDescriptors?: boolean;
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

const EMPTY_OPTIONS: O = {};
const HAS_OWN = Object.prototype.hasOwnProperty;
const OBJECT_TO_STRING = Object.prototype.toString;

//
// [API]
//

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

  const sourceIsObject = isObject(source);

  if (!isObject(target) || !sourceIsObject) {
    return sourceIsObject ? clone(source, options, ref) : source;
  }

  if (Object.isFrozen(target)) {
    throw new TypeError('Target object frozen.');
  }

  // [Ref]
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
    ref.set(source, result); // [Ref.set]

    for (const v of target) {
      result.add(clone(v, options, ref));
    }

    for (const v of source) {
      result.add(clone(v, options, ref));
    }

    return result as T | S;
  }

  if (isPlainObject(target) && isPlainObject(source)) {
    if (!options.preserveDescriptors) {
      if (isObjectPrototype(target) && isObjectPrototype(source)) {
        return fastMerge(target, source, options, ref) as T | S;
      }

      return merge(target, source, options, ref) as T | S;
    }

    return mergeWithDescriptors(target, source, options, ref) as T | S;
  }

  // Fallback: unmergeable types
  return clone(source, options, ref);
}

//
// [Merge]
//

function merge(
  target: PlainObject,
  source: PlainObject,
  options: O,
  ref: Ref,
): PlainObject {
  ref.set(source, target); // [Ref.set]
  let targetKeys: string[] | null = null;
  const sourceKeys = Reflect.ownKeys(source);
  let result: PlainObject | null = null;
  const proto = Object.getPrototypeOf(target);

  for (let i = 0, l = sourceKeys.length; i < l; i++) {
    const sourceKey = sourceKeys[i];

    if (isUnsafeKey(sourceKey)) {
      continue;
    }

    const targetValue = target[sourceKey as keyof typeof target];
    const sourceValue = source[sourceKey as keyof typeof source];

    if (!HAS_OWN.call(target, sourceKey)) {
      if (result === null) {
        result = Object.create(proto) as PlainObject;
        targetKeys ??= Object.keys(target);

        for (let j = 0, m = targetKeys.length; j < m; j++) {
          const targetKey = targetKeys[j];
          result[targetKey] = target[targetKey];
        }

        ref.set(source, result); // [Ref.set]
      }

      result[sourceKey as keyof PlainObject] = clone(sourceValue, options, ref);
      continue;
    }

    const mergedValue = dispatch(targetValue, sourceValue, options, ref);

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = Object.create(proto) as PlainObject;
        targetKeys ??= Object.keys(target);

        for (let j = 0, m = targetKeys.length; j < m; j++) {
          const targetKey = targetKeys[j];
          result[targetKey] = target[targetKey];
        }

        ref.set(source, result); // [Ref.set]
      }

      result[sourceKey as keyof PlainObject] = mergedValue;
    }
  }

  return result ?? target;
}

function fastMerge(
  target: PlainObject,
  source: PlainObject,
  options: O,
  ref: Ref,
): PlainObject {
  ref.set(source, target); // [Ref.set]
  let result: PlainObject | null = null;

  for (const key in source) {
    if (!HAS_OWN.call(source, key) || isUnsafeKey(key)) {
      continue;
    }

    const targetValue = target[key];
    const sourceValue = source[key];

    if (!HAS_OWN.call(target, key)) {
      if (result === null) {
        result = { ...target };
        ref.set(source, result); // [Ref.set]
      }

      result[key] = clone(sourceValue, options, ref);
      continue;
    }

    const mergedValue = dispatch(targetValue, sourceValue, options, ref);

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = { ...target };
        ref.set(source, result); // [Ref.set]
      }

      result[key] = mergedValue;
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
  const nullish = options.nullish ?? 'loose';

  if (
    arrays === 'merge' &&
    nullish !== 'loose' &&
    isShallowArray(target) &&
    isShallowArray(source)
  ) {
    return source.slice();
  }

  if (arrays === 'replace') {
    return clone(source, options, ref) as unknown[];
  }

  ref.set(source, target); // [Ref.set]

  const targetLength = target.length;
  const sourceLength = source.length;

  if (arrays === 'concat') {
    const result = new Array(targetLength + sourceLength);

    for (let i = 0, l = targetLength; i < l; i++) {
      result[i] = target[i];
    }

    for (let i = 0, l = sourceLength; i < l; i++) {
      result[targetLength + i] = clone(source[i], options, ref);
    }

    ref.set(source, result); // [Ref.set]
    return result;
  }

  // arrays === 'merge'
  let result: unknown[] | null = null;

  for (let i = 0, l = Math.max(targetLength, sourceLength); i < l; i++) {
    const hasTarget = i < targetLength;
    const hasSource = i < sourceLength;
    const targetValue = hasTarget ? target[i] : undefined;
    const sourceValue = hasSource ? source[i] : undefined;

    if (hasSource && sourceValue == null && nullish === 'loose') {
      if (hasTarget && result === null) {
        result = [...target];
        ref.set(source, result); // [Ref.set]
      }

      continue;
    }

    if (!hasSource && hasTarget) {
      if (result === null) {
        result = [...target];
        ref.set(source, result); // [Ref.set]
      }

      result[i] = targetValue;
      continue;
    }

    const mergedValue = !hasTarget
      ? clone(sourceValue, options, ref)
      : dispatch(targetValue, sourceValue, options, ref);
    const resultLength = result?.length ?? 0;

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = [...target];
        ref.set(source, result); // [Ref.set]
      }

      if (resultLength <= i) {
        result.length = i + 1;
      }

      result[i] = mergedValue;
    } else if (result !== null) {
      if (resultLength <= i) {
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
  ref.set(source, target); // [Ref.set]
  let result: Map<K, V> | null = null;

  for (const [key, sourceValue] of source) {
    if (!target.has(key)) {
      if (result === null) {
        result = new Map(target);
        ref.set(source, result); // [Ref.set]
      }

      result.set(key, clone(sourceValue, options, ref) as V);
      continue;
    }

    const targetValue = target.get(key) as V;
    const mergedValue = dispatch(targetValue, sourceValue, options, ref) as V;

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = new Map(target);
        ref.set(source, result); // [Ref.set]
      }

      result.set(key, mergedValue);
    }
  }

  return result ?? (target as Map<K, V>);
}

function mergeWithDescriptors(
  target: AnyObject,
  source: AnyObject,
  options: O,
  ref: Ref,
): AnyObject {
  const placeholder = Object.create(Object.getPrototypeOf(target));
  ref.set(source, placeholder); // [Ref.set]
  const targetDescs = Object.getOwnPropertyDescriptors(target);
  const sourceDescs = Object.getOwnPropertyDescriptors(source);
  const keys = Reflect.ownKeys(sourceDescs);
  let result: AnyObject | null = null;

  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];

    if (isUnsafeKey(key)) {
      continue;
    }

    const targetDesc = targetDescs[key as string | symbol];
    const sourceDesc = sourceDescs[key as string | symbol];

    if ('value' in sourceDesc) {
      const mergedValue =
        targetDesc === undefined || !('value' in targetDesc)
          ? clone(sourceDesc.value, options, ref)
          : dispatch(
              targetDesc && 'value' in targetDesc
                ? targetDesc.value
                : undefined,
              sourceDesc.value,
              options,
              ref,
            );

      if (
        targetDesc &&
        (targetDesc.configurable === false ||
          ('value' in targetDesc &&
            targetDesc.writable === false &&
            !isSame(mergedValue, targetDesc.value)))
      ) {
        if (options.strictDescriptors) {
          throw new TypeError(
            `Cannot merge descriptor for key ${String(key)}: ` +
              `configurable=${targetDesc.configurable}, ` +
              `writable=${'value' in targetDesc ? targetDesc.writable : 'N/A'}`,
          );
        }

        continue;
      }

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
    ref.set(source, target); // [Ref.set]
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

  // [Ref]
  const cached = ref.get(value);

  if (cached !== undefined) {
    return cached as T;
  }

  if (isPlainObject(value)) {
    const result = Object.create(Object.getPrototypeOf(value)) as PlainObject;
    ref.set(value, result); // [Ref.set]

    for (const key in value) {
      if (!HAS_OWN.call(value, key) || isUnsafeKey(key)) {
        continue;
      }

      result[key] = clone(value[key], options, ref);
    }

    return result as T;
  }

  // Array
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    ref.set(value, result); // [Ref.set]

    for (let i = 0, l = value.length; i < l; i++) {
      result[i] = clone(value[i], options, ref);
    }

    return result as T;
  }

  // Date
  if (value instanceof Date) {
    const result = new Date(value.getTime());
    ref.set(value, result); // [Ref.set]
    return result as T;
  }

  // RegExp
  if (value instanceof RegExp) {
    const result = new RegExp(value.source, value.flags);
    ref.set(value, result); // [Ref.set]
    result.lastIndex = value.lastIndex;
    return result as T;
  }

  // ArrayBuffer
  if (value instanceof ArrayBuffer) {
    const result = value.slice(0);
    ref.set(value, result);
    return result as T;
  }

  // TypedArray
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const Ctor = value.constructor as any;
    const result = new Ctor(value);
    ref.set(value, result);
    return result as T;
  }

  // DataView
  if (value instanceof DataView) {
    const result = new DataView(value.buffer.slice(0), value.byteOffset, value.byteLength);
    ref.set(value, result);
    return result as T;
  }

  // Error and DOMException
  if (
    value instanceof Error ||
    (typeof DOMException !== 'undefined' && value instanceof DOMException)
  ) {
    const result = cloneError(value);
    ref.set(value, result); // [Ref.set]
    return result as T;
  }

  // Blob
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    const result = value.slice(0, value.size, value.type);
    ref.set(value, result);
    return result as T;
  }

  // ImageData
  if (typeof ImageData !== "undefined" && value instanceof ImageData) {
    const result = new ImageData(
      new Uint8ClampedArray(value.data),
      value.width,
      value.height,
    );
    ref.set(value, result);
    return result as T;
  }

  // Map
  if (value instanceof Map) {
    const result = new Map();
    ref.set(value, result); // [Ref.set]
    for (const [key, v] of value) {
      // result.set(key, clone(v, options, ref));
      result.set(clone(key, options, ref), clone(v, options, ref));
    }

    return result as T;
  }

  // Set
  if (value instanceof Set) {
    const result = new Set();
    ref.set(value, result); // [Ref.set]

    for (const v of value) {
      result.add(clone(v, options, ref));
    }

    return result as T;
  }

  // With descriptors
  if (options.preserveDescriptors) {
    return cloneWithDescriptors(value as AnyObject, options, ref) as T;
  }

  // Fallback: unsupported types
  ref.set(value, value); // [Ref.set]
  return value;
}

function cloneError(value: unknown): Error {
  if (!(value instanceof Error)) {
    throw new TypeError('Expected Error');
  }

  const name = value.name || 'Error';
  const message = value.message || '';
  let result: Error;

  switch (name) {
    case 'RangeError':
      result = new RangeError(message);
      break;
    case 'ReferenceError':
      result = new ReferenceError(message);
      break;
    case 'SyntaxError':
      result = new SyntaxError(message);
      break;
    case 'TypeError':
      result = new TypeError(message);
      break;
    default:
      result = new Error(message);
      result.name = name;
  }

  if (value.stack) {
    result.stack = value.stack;
  }

  for (const key of Object.keys(value) as (keyof typeof value)[]) {
    if (key === 'name' || key === 'message' || key === 'stack') {
      continue;
    }

    result[key] = value[key];
  }

  return result;
}

function cloneWithDescriptors(
  value: AnyObject,
  options: O,
  ref: Ref,
): AnyObject {
  const result = Object.create(Object.getPrototypeOf(value)) as AnyObject;
  ref.set(value, result); // [Ref.set]
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
      key === 'arrays' ||
      key === 'nullish' ||
      key === 'preserveDescriptors' ||
      key === 'strictDescriptors'
    );
  });
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isObjectPrototype(value: unknown): value is PlainObject {
  return Object.getPrototypeOf(value) === Object.prototype;
}

function isPlainObject(value: unknown): value is PlainObject {
  return OBJECT_TO_STRING.call(value) === '[object Object]';
}

function isSame(a: unknown, b: unknown): boolean {
  // biome-ignore lint/suspicious/noSelfCompare: performance optimization
  return a === b || (a !== a && b !== b);
}

function isShallowArray(array: readonly unknown[]): boolean {
  for (let i = 0, l = array.length; i < l; i++) {
    if (isObject(array[i])) {
      return false;
    }
  }

  return true;
}

function isUnsafeKey(key: PropertyKey): boolean {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}
