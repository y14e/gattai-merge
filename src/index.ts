/**
 * gattai-merge
 * High-performance deep merge utility with structural sharing.
 * Supports circular ref and complex built-in types.
 *
 * @version 3.0.9
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) 2026 Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/gattai-merge}
 */

// -----------------------------------------------------------------------------
// [Types]
// -----------------------------------------------------------------------------

export interface GattaiMergeOptions {
  readonly arrays?: 'replace' | 'concat' | 'merge';
  readonly nullish?: 'loose' | 'strict' | 'throw';
  readonly preserveDescriptors?: boolean;
  readonly strictDescriptors?: boolean;
}

type O = GattaiMergeOptions;

type AnyObject = Record<PropertyKey, unknown>;

type PlainObject = Record<string, unknown>;

type Ref = WeakMap<object, unknown>;

type MergedObject<T, S> = [T, S] extends [
  readonly unknown[],
  readonly unknown[],
]
  ? T | S
  : [T, S] extends [object, object]
    ? Omit<T, keyof S> & S
    : S;

type DeepMergedObject<
  T extends object,
  S extends readonly unknown[],
> = S extends readonly [infer F, ...infer R]
  ? MergedObject<T, F> extends object
    ? DeepMergedObject<MergedObject<T, F>, R>
    : MergedObject<T, F>
  : T;

// -----------------------------------------------------------------------------
// [API]
// -----------------------------------------------------------------------------

const EMPTY_OPTIONS: O = {};
const HAS_OWN = Object.prototype.hasOwnProperty;
const OBJECT_TO_STRING = Object.prototype.toString;

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

// -----------------------------------------------------------------------------
// [Dispatch]
// -----------------------------------------------------------------------------

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

    for (const item of target) {
      result.add(clone(item, options, ref));
    }

    for (const item of source) {
      result.add(clone(item, options, ref));
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

// -----------------------------------------------------------------------------
// [Merge]
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// [Clone]
// -----------------------------------------------------------------------------

function clone<T>(node: T, options: O, ref: Ref): T {
  if (!isObject(node)) {
    return node;
  }

  // [Ref]
  const cached = ref.get(node);

  if (cached !== undefined) {
    return cached as T;
  }

  if (isPlainObject(node)) {
    const result = Object.create(Object.getPrototypeOf(node)) as PlainObject;
    ref.set(node, result); // [Ref.set]

    for (const key in node) {
      if (!HAS_OWN.call(node, key) || isUnsafeKey(key)) {
        continue;
      }

      result[key] = clone(node[key], options, ref);
    }

    return result as T;
  }

  // Array
  if (Array.isArray(node)) {
    const result: unknown[] = [];
    ref.set(node, result); // [Ref.set]

    for (let i = 0, l = node.length; i < l; i++) {
      result[i] = clone(node[i], options, ref);
    }

    return result as T;
  }

  // Date
  if (node instanceof Date) {
    const result = new Date(node.getTime());
    ref.set(node, result); // [Ref.set]
    return result as T;
  }

  // RegExp
  if (node instanceof RegExp) {
    const result = new RegExp(node.source, node.flags);
    ref.set(node, result); // [Ref.set]
    result.lastIndex = node.lastIndex;
    return result as T;
  }

  // ArrayBuffer
  if (node instanceof ArrayBuffer) {
    const result = node.slice(0);
    ref.set(node, result);
    return result as T;
  }

  // TypedArray
  if (ArrayBuffer.isView(node) && !(node instanceof DataView)) {
    const Ctor = node.constructor as new (_: typeof node) => typeof node;
    const result = new Ctor(node);
    ref.set(node, result);
    return result as T;
  }

  // DataView
  if (node instanceof DataView) {
    const result = new DataView(
      node.buffer.slice(0),
      node.byteOffset,
      node.byteLength,
    );
    ref.set(node, result);
    return result as T;
  }

  // Error and DOMException
  if (
    node instanceof Error ||
    (typeof DOMException !== 'undefined' && node instanceof DOMException)
  ) {
    const result = cloneError(node);
    ref.set(node, result); // [Ref.set]
    return result as T;
  }

  // Blob
  if (typeof Blob !== 'undefined' && node instanceof Blob) {
    const result = node.slice(0, node.size, node.type);
    ref.set(node, result);
    return result as T;
  }

  // ImageData
  if (typeof ImageData !== 'undefined' && node instanceof ImageData) {
    const result = new ImageData(
      new Uint8ClampedArray(node.data),
      node.width,
      node.height,
    );
    ref.set(node, result);
    return result as T;
  }

  // Map
  if (node instanceof Map) {
    const result = new Map();
    ref.set(node, result); // [Ref.set]

    for (const [key, value] of node) {
      result.set(clone(key, options, ref), clone(value, options, ref));
    }

    return result as T;
  }

  // Set
  if (node instanceof Set) {
    const result = new Set();
    ref.set(node, result); // [Ref.set]

    for (const item of node) {
      result.add(clone(item, options, ref));
    }

    return result as T;
  }

  // With descriptors
  if (options.preserveDescriptors) {
    return cloneWithDescriptors(node as AnyObject, options, ref) as T;
  }

  // Fallback: unsupported types
  ref.set(node, node); // [Ref.set]
  return node;
}

function cloneError(value: Error): Error {
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
  node: AnyObject,
  options: O,
  ref: Ref,
): AnyObject {
  const result = Object.create(Object.getPrototypeOf(node)) as AnyObject;
  ref.set(node, result); // [Ref.set]
  const descriptors = Object.getOwnPropertyDescriptors(node);
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

// -----------------------------------------------------------------------------
// [Utils]
// -----------------------------------------------------------------------------

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
