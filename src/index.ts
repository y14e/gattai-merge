/**
 * Gattai Merge
 * High-performance deep merge utility with structural sharing.
 * Supports circular ref and complex built-in types.
 *
 * @version 3.2.0
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) 2026 Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/gattai-merge}
 */

// -----------------------------------------------------------------------------
// [Types]
// -----------------------------------------------------------------------------

export interface GattaiMergeOptions {
  readonly arrays?: 'replace' | 'concat' | 'merge' | ArrayMergeFunction;
  readonly nullish?: 'loose' | 'strict' | 'throw';
  readonly preserveDescriptors?: boolean;
  readonly strictDescriptors?: boolean;
}

type Object = Record<PropertyKey, unknown>;

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

type ArrayMergeFunction = (
  target: readonly unknown[],
  source: readonly unknown[],
  context: ArrayContext,
) => unknown[];

type ArrayContext = {
  options: GattaiMergeOptions;
  ref: Ref;
  merge: (target: unknown, source: unknown) => unknown;
  clone: (node: unknown) => unknown;
};

// -----------------------------------------------------------------------------
// [Constants]
// -----------------------------------------------------------------------------

const EMPTY_OPTIONS = {};
const { hasOwnProperty: HAS_OWN } = Object.prototype;

// -----------------------------------------------------------------------------
// [API]
// -----------------------------------------------------------------------------

export default function gattaiMerge<
  T extends object,
  S extends readonly unknown[],
>(target: T, ...args: S): DeepMergedObject<T, S>;
export default function gattaiMerge<
  T extends object,
  S extends readonly unknown[],
>(target: T, ...args: [...S, GattaiMergeOptions]): DeepMergedObject<T, S>;
export default function gattaiMerge(target: unknown, ...args: unknown[]) {
  const length = args.length;
  const last = length > 0 ? args[length - 1] : undefined;
  const hasOptions = isGattaiMergeOptions(last);
  const options = (hasOptions ? last : EMPTY_OPTIONS) as GattaiMergeOptions;
  let result: unknown = target;

  for (let i = 0, l = hasOptions ? length - 1 : length; i < l; i++) {
    result = merge(result, args[i], options, new WeakMap());
  }

  return result;
}

// -----------------------------------------------------------------------------
// [Merge]
// -----------------------------------------------------------------------------

function merge(
  target: unknown,
  source: unknown,
  options: GattaiMergeOptions,
  ref: Ref,
) {
  if (isSame(target, source)) {
    return target;
  }

  // Nullish
  if (source == null) {
    const nullish = options.nullish ?? 'loose';

    if (nullish === 'strict') {
      return source;
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
    return cached;
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    return mergeArray(target, source, options, ref);
  }

  if (target instanceof Map && source instanceof Map) {
    return mergeMap(target, source, options, ref);
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

    return result;
  }

  if (isPlainObject(target) && isPlainObject(source)) {
    if (!options.preserveDescriptors) {
      if (isObjectPrototype(target) && isObjectPrototype(source)) {
        return mergePlainObjectFast(
          target as Object,
          source as Object,
          options,
          ref,
        );
      }

      return mergePlainObject(target as Object, source as Object, options, ref);
    }

    return mergeWithDescriptors(
      target as Object,
      source as Object,
      options,
      ref,
    );
  }

  // Fallback: unmergeable types
  return clone(source, options, ref);
}

function mergePlainObject(
  target: Object,
  source: Object,
  options: GattaiMergeOptions,
  ref: Ref,
) {
  ref.set(source, target); // [Ref.set]
  let targetKeys: string[] | null = null;
  let result: Object | null = null;
  const proto = Object.getPrototypeOf(target);

  forEachOwnKey(source, (sourceKey) => {
    if (isUnsafeKey(sourceKey)) {
      return;
    }

    const targetValue = target[sourceKey];
    const sourceValue = source[sourceKey];

    if (HAS_OWN.call(target, sourceKey)) {
      const mergedValue = merge(targetValue, sourceValue, options, ref);

      if (!isSame(mergedValue, targetValue)) {
        if (result === null) {
          result = Object.create(proto) as Object;
          targetKeys ??= Object.keys(target);

          for (let j = 0, m = targetKeys.length; j < m; j++) {
            const k = targetKeys[j] as string;
            result[k] = target[k];
          }

          ref.set(source, result);
        }

        result[sourceKey] = mergedValue;
      }
    } else {
      if (result === null) {
        result = Object.create(proto) as Object;
        targetKeys ??= Object.keys(target);

        for (let j = 0, m = targetKeys.length; j < m; j++) {
          const k = targetKeys[j] as string;
          result[k] = target[k];
        }

        ref.set(source, result);
      }

      result[sourceKey] = clone(sourceValue, options, ref);
    }
  });

  return result ?? target;
}

function mergePlainObjectFast(
  target: Object,
  source: Object,
  options: GattaiMergeOptions,
  ref: Ref,
) {
  ref.set(source, target); // [Ref.set]
  let result = null;

  for (const key in source) {
    if (!HAS_OWN.call(source, key) || isUnsafeKey(key)) {
      continue;
    }

    const targetValue = target[key];
    const sourceValue = source[key];

    if (targetValue === sourceValue) {
      continue;
    }

    if (!HAS_OWN.call(target, key)) {
      if (result === null) {
        result = { ...target };
        ref.set(source, result); // [Ref.set]
      }

      result[key] = clone(sourceValue, options, ref);
      continue;
    }

    if (
      sourceValue === null ||
      typeof sourceValue !== 'object' ||
      targetValue === null ||
      typeof targetValue !== 'object'
    ) {
      if (result === null) {
        result = { ...target };
        ref.set(source, result); // [Ref.set]
      }

      result[key] = sourceValue;
      continue;
    }

    const mergedValue = merge(targetValue, sourceValue, options, ref);

    if (mergedValue !== targetValue) {
      if (result === null) {
        result = { ...target };
        ref.set(source, result); // [Ref.set]
      }

      result[key] = mergedValue;
    }
  }

  return result ?? target;
}

const BUILTIN_ARRAY_MERGE_FUNCTIONS: Record<
  'replace' | 'concat' | 'merge',
  ArrayMergeFunction
> = {
  replace: (_target, source) => source.slice(),

  concat: (target, source, { clone }) => {
    const result = new Array(target.length + source.length);

    for (let i = 0, l = target.length; i < l; i++) {
      result[i] = target[i];
    }

    for (let i = 0, l = source.length; i < l; i++) {
      result[target.length + i] = clone(source[i]);
    }

    return result;
  },

  merge: (target, source, { merge, clone }) => {
    let result: unknown[] | null = null;

    for (let i = 0, l = Math.max(target.length, source.length); i < l; i++) {
      const targetValue = target[i];
      const sourceValue = source[i];
      const mergedValue =
        i in source
          ? i in target
            ? merge(targetValue, sourceValue)
            : clone(sourceValue)
          : targetValue;

      if (result === null && mergedValue !== targetValue) {
        result = [...target];
      }

      if (result) {
        result[i] = mergedValue;
      }
    }

    return result ?? (target as unknown[]);
  },
};

function createArrayContext(options: GattaiMergeOptions, ref: Ref) {
  return {
    options,
    ref,
    merge: (target: unknown, source: unknown) =>
      merge(target, source, options, ref),
    clone: (node: unknown) => clone(node, options, ref),
  };
}

function mergeArray(
  target: readonly unknown[],
  source: readonly unknown[],
  options: GattaiMergeOptions,
  ref: Ref,
) {
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

  return (
    typeof arrays !== 'function'
      ? BUILTIN_ARRAY_MERGE_FUNCTIONS[arrays]
      : arrays
  )(target, source, createArrayContext(options, ref));
}

function mergeMap<K, V>(
  target: ReadonlyMap<K, V>,
  source: ReadonlyMap<K, V>,
  options: GattaiMergeOptions,
  ref: Ref,
) {
  ref.set(source, target); // [Ref.set]
  let result = null;

  for (const [key, sourceValue] of source) {
    if (!target.has(key)) {
      if (result === null) {
        result = new Map(target);
        ref.set(source, result); // [Ref.set]
      }

      result.set(key, clone(sourceValue, options, ref));
      continue;
    }

    const targetValue = target.get(key);
    const mergedValue = merge(targetValue, sourceValue, options, ref);

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = new Map(target);
        ref.set(source, result); // [Ref.set]
      }

      result.set(key, mergedValue as V);
    }
  }

  return result ?? target;
}

function mergeWithDescriptors(
  target: Object,
  source: Object,
  options: GattaiMergeOptions,
  ref: Ref,
) {
  const placeholder = Object.create(Object.getPrototypeOf(target));
  ref.set(source, placeholder); // [Ref.set]
  const targetDescs = Object.getOwnPropertyDescriptors(target);
  const sourceDescs = Object.getOwnPropertyDescriptors(source);
  let result: Object | null = null;

  forEachOwnKey(sourceDescs, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }

    const targetDesc = targetDescs[key];
    const sourceDesc = sourceDescs[key] as PropertyDescriptor;

    if ('value' in sourceDesc) {
      const mergedValue =
        targetDesc === undefined || !('value' in targetDesc)
          ? clone(sourceDesc.value, options, ref)
          : merge(
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

        return;
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
  });

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
// [Clone] (bunshin-clone)
// -----------------------------------------------------------------------------

function clone(node: unknown, options: GattaiMergeOptions, ref: Ref) {
  if (!isObject(node)) {
    return node;
  }

  // [Ref]
  const cached = ref.get(node);

  if (cached !== undefined) {
    return cached;
  }

  // With descriptors
  if (options.preserveDescriptors && isPlainObject(node)) {
    return cloneWithDescriptors(node as Object, options, ref);
  }

  // Array
  if (Array.isArray(node)) {
    const result: unknown[] = [];
    ref.set(node, result); // [Ref.set]

    for (let i = 0, l = node.length; i < l; i++) {
      result[i] = clone(node[i], options, ref);
    }

    return result;
  }

  // Plain object
  if (isPlainObject(node)) {
    const result = Object.create(Object.getPrototypeOf(node));
    ref.set(node, result); // [Ref.set]

    for (const key in node) {
      if (!HAS_OWN.call(node, key) || isUnsafeKey(key)) {
        continue;
      }

      result[key] = clone((node as Object)[key], options, ref);
    }

    return result;
  }

  // Map
  if (node instanceof Map) {
    const result = new Map();
    ref.set(node, result); // [Ref.set]

    for (const [key, value] of node) {
      result.set(clone(key, options, ref), clone(value, options, ref));
    }

    return result;
  }

  // Set
  if (node instanceof Set) {
    const result = new Set();
    ref.set(node, result); // [Ref.set]

    for (const item of node) {
      result.add(clone(item, options, ref));
    }

    return result;
  }

  // Date
  if (node instanceof Date) {
    const result = new Date(node.getTime());
    ref.set(node, result); // [Ref.set]
    return result;
  }

  // RegExp
  if (node instanceof RegExp) {
    const result = new RegExp(node.source, node.flags);
    ref.set(node, result); // [Ref.set]
    result.lastIndex = node.lastIndex;
    return result;
  }

  // ArrayBuffer
  if (node instanceof ArrayBuffer) {
    const result = node.slice(0);
    ref.set(node, result); // [Ref.set]
    return result;
  }

  // DataView and TypedArray
  if (ArrayBuffer.isView(node)) {
    const { buffer, byteOffset, byteLength } = node;
    if (node instanceof DataView) {
      const result = new DataView(buffer.slice(0), byteOffset, byteLength);
      ref.set(node, result); // [Ref.set]
      return result;
    } else {
      const Ctor = node.constructor as new (
        buffer: ArrayBufferLike,
      ) => ArrayBufferView;
      const result = new Ctor(
        buffer.slice(byteOffset, byteOffset + byteLength),
      );
      ref.set(node, result); // [Ref.set]
      return result;
    }
  }

  // Error and DOMException
  if (
    node instanceof Error ||
    (typeof DOMException !== 'undefined' && node instanceof DOMException)
  ) {
    return cloneError(node, options, ref);
  }

  // Blob
  if (typeof Blob !== 'undefined' && node instanceof Blob) {
    const result = node.slice(0, node.size, node.type);
    ref.set(node, result); // [Ref.set]
    return result;
  }

  // ImageData
  if (typeof ImageData !== 'undefined' && node instanceof ImageData) {
    const result = new ImageData(
      new Uint8ClampedArray(node.data),
      node.width,
      node.height,
    );
    ref.set(node, result); // [Ref.set]
    return result;
  }

  // URL
  if (typeof URL !== 'undefined' && node instanceof URL) {
    const result = new URL(node.href);
    ref.set(node, result); // [Ref.set]
    return result;
  }

  // URLSearchParams
  if (
    typeof URLSearchParams !== 'undefined' &&
    node instanceof URLSearchParams
  ) {
    const result = new URLSearchParams();
    ref.set(node, result); // [Ref.set]

    for (const [key, value] of node) {
      result.append(key, value);
    }

    return result;
  }

  // Fallback: unsupported types
  ref.set(node, node); // [Ref.set]
  return node;
}

function cloneError(
  value: Error | DOMException,
  options: GattaiMergeOptions,
  ref: Ref,
): Error | DOMException {
  if (value instanceof DOMException) {
    const result = new DOMException(value.message, value.name);
    ref.set(value, result); // [Ref.set]
    return result;
  }

  const name = value.name || 'Error';
  const message = value.message || '';
  let result: Error;

  switch (name) {
    case 'EvalError':
      result = new EvalError(message);
      break;
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
    case 'URIError':
      result = new URIError(message);
      break;
    default:
      result = new Error(message);
      result.name = name;
  }

  ref.set(value, result); // [Ref.set]

  if (value.stack) {
    try {
      result.stack = value.stack;
    } catch {}
  }

  if ('cause' in value && value.cause !== undefined) {
    result.cause = clone(value.cause, options, ref);
  }

  for (const key of Object.keys(value) as (keyof Error)[]) {
    result[key] = clone(value[key], options, ref);
  }

  return result;
}

function cloneWithDescriptors(
  node: Object,
  options: GattaiMergeOptions,
  ref: Ref,
) {
  const result = Object.create(Object.getPrototypeOf(node));
  ref.set(node, result); // [Ref.set]
  const descs = Object.getOwnPropertyDescriptors(node);

  forEachOwnKey(descs, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }

    const desc = { ...descs[key] };

    if ('value' in desc) {
      desc.value = clone(desc.value, options, ref);
    }

    try {
      Object.defineProperty(result, key, desc);
    } catch (error) {
      if (options.strictDescriptors) {
        throw error;
      }
    }
  });

  return result;
}

// -----------------------------------------------------------------------------
// [Utils]
// -----------------------------------------------------------------------------

function forEachOwnKey(
  object: object,
  callback: (key: string | symbol) => void,
) {
  for (const key of Object.keys(object)) {
    callback(key);
  }

  const symbols = Object.getOwnPropertySymbols(object);

  for (let i = 0, l = symbols.length; i < l; i++) {
    callback(symbols[i] as symbol);
  }
}

function isGattaiMergeOptions(value: unknown) {
  if (!isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value as object);

  if (keys.length === 0) {
    return true;
  }

  return keys.every(
    (key) =>
      key === 'arrays' ||
      key === 'nullish' ||
      key === 'preserveDescriptors' ||
      key === 'strictDescriptors',
  );
}

function isObject(value: unknown) {
  return typeof value === 'object' && value !== null;
}

function isObjectPrototype(value: unknown) {
  return Object.getPrototypeOf(value) === Object.prototype;
}

function isPlainObject(value: unknown) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isSame(a: unknown, b: unknown) {
  // biome-ignore lint/suspicious/noSelfCompare: performance optimization
  return a === b || (a !== a && b !== b);
}

function isShallowArray(array: readonly unknown[]) {
  for (let i = 0, l = array.length; i < l; i++) {
    if (isObject(array[i])) {
      return false;
    }
  }

  return true;
}

function isUnsafeKey(key: PropertyKey) {
  return (
    typeof key === 'string' &&
    (key === '__proto__' || key === 'prototype' || key === 'constructor')
  );
}
