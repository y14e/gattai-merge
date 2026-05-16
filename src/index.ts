/**
 * Gattai Merge
 * High-performance deep merge utility with structural sharing.
 * Supports circular ref and complex built-in types.
 *
 * @version 3.4.2
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/gattai-merge}
 */

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import clone from 'bunshin-clone';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GattaiMergeOptions {
  readonly arrays?: 'replace' | 'concat' | 'merge' | ArrayMergeFunction;
  readonly nullish?: 'loose' | 'strict' | 'throw';
  readonly preserveDescriptors?: boolean;
  readonly strictDescriptors?: boolean;
}

type Object = Record<PropertyKey, unknown>;

type Refs = WeakMap<object, unknown>;

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

type MergeContext = {
  options: GattaiMergeOptions;
  ref: Refs;
  merge: (target: unknown, source: unknown) => unknown;
  clone: (node: unknown) => unknown;
};

type ArrayMergeFunction = (
  target: readonly unknown[],
  source: readonly unknown[],
  context: MergeContext,
) => unknown[];

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const EMPTY_OPTIONS = {};
const { hasOwnProperty: HAS_OWN } = Object.prototype;

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

export default function gattaiMerge<
  T extends object,
  S extends readonly unknown[],
>(target: T, ...args: S): DeepMergedObject<T, S>;
export default function gattaiMerge<
  T extends object,
  S extends readonly unknown[],
>(target: T, ...args: [...S, GattaiMergeOptions]): DeepMergedObject<T, S> {
  const length = args.length;
  const last = length ? args[length - 1] : undefined;
  const hasOptions = isGattaiMergeOptions(last);
  const options = (hasOptions ? last : EMPTY_OPTIONS) as GattaiMergeOptions;
  let result = target;

  for (let i = 0, l = hasOptions ? length - 1 : length; i < l; i++) {
    result = merge(result, args[i], options, new WeakMap());
  }

  return result as DeepMergedObject<T, S>;
}

// -----------------------------------------------------------------------------
// Core
// -----------------------------------------------------------------------------

function merge(
  target: unknown,
  source: unknown,
  options: GattaiMergeOptions,
  refs: Refs,
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
      throw new TypeError('Source object nullish');
    }

    return target;
  }

  if (target == null) {
    return clone(source, options, refs);
  }

  const isObjectSource = isObject(source);

  if (!isObject(target) || !isObjectSource) {
    return isObjectSource ? clone(source, options, refs) : source;
  }

  if (Object.isFrozen(target)) {
    throw new TypeError('Target object frozen');
  }

  // [Refs]
  const ref = refs.get(source);

  if (ref !== undefined) {
    return ref;
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    return mergeArray(target, source, options, refs);
  }

  if (target instanceof Map && source instanceof Map) {
    return mergeMap(target, source, options, refs);
  }

  if (target instanceof Set && source instanceof Set) {
    const result = new Set<unknown>();
    refs.set(source, result); // [Ref.set]

    for (const item of target) {
      result.add(clone(item, options, refs));
    }

    for (const item of source) {
      result.add(clone(item, options, refs));
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
          refs,
        );
      }

      return mergePlainObject(
        target as Object,
        source as Object,
        options,
        refs,
      );
    }

    return mergeWithDescriptors(
      target as Object,
      source as Object,
      options,
      refs,
    );
  }

  // Fallback: unmergeable types
  return clone(source, options, refs);
}

function mergePlainObject(
  target: Object,
  source: Object,
  options: GattaiMergeOptions,
  refs: Refs,
) {
  refs.set(source, target); // [Refs.set]
  let targetKeys: string[] | null = null;
  let result: Object | null = null;
  const proto = Object.getPrototypeOf(target);

  function ensure() {
    result = Object.create(proto) as Object;
    targetKeys ??= Object.keys(target);

    for (let i = 0, l = targetKeys.length; i < l; i++) {
      const key = targetKeys[i] as string;
      result[key] = target[key];
    }

    refs.set(source, result);
  }

  forEachOwnKey(source, (sourceKey) => {
    if (isUnsafeKey(sourceKey)) {
      return;
    }

    const targetValue = target[sourceKey];
    const sourceValue = source[sourceKey];

    if (HAS_OWN.call(target, sourceKey)) {
      const mergedValue = merge(targetValue, sourceValue, options, refs);

      if (!isSame(mergedValue, targetValue)) {
        result === null && ensure();
        (result as Object)[sourceKey] = mergedValue;
      }
    } else {
      result === null && ensure();
      (result as Object)[sourceKey] = clone(sourceValue, options, refs);
    }
  });

  return result ?? target;
}

function mergePlainObjectFast(
  target: Object,
  source: Object,
  options: GattaiMergeOptions,
  refs: Refs,
) {
  refs.set(source, target); // [Refs.set]
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
        refs.set(source, result); // [Refs.set]
      }

      result[key] = clone(sourceValue, options, refs);
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
        refs.set(source, result); // [Refs.set]
      }

      result[key] = sourceValue;
      continue;
    }

    const mergedValue = merge(targetValue, sourceValue, options, refs);

    if (mergedValue !== targetValue) {
      if (result === null) {
        result = { ...target };
        refs.set(source, result); // [Refs.set]
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
  replace: (_, source) => source.slice(),

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

function createArrayContext(options: GattaiMergeOptions, ref: Refs) {
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
  ref: Refs,
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
  refs: Refs,
) {
  refs.set(source, target); // [Refs.set]
  let result = null;

  for (const [key, sourceValue] of source) {
    if (!target.has(key)) {
      if (result === null) {
        result = new Map(target);
        refs.set(source, result); // [Refs.set]
      }

      result.set(key, clone(sourceValue, options, refs));
      continue;
    }

    const targetValue = target.get(key);
    const mergedValue = merge(targetValue, sourceValue, options, refs);

    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = new Map(target);
        refs.set(source, result); // [Refs.set]
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
  refs: Refs,
) {
  const placeholder = Object.create(Object.getPrototypeOf(target));
  refs.set(source, placeholder); // [Refs.set]
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
          ? clone(sourceDesc.value, options, refs)
          : merge(
              targetDesc && 'value' in targetDesc
                ? targetDesc.value
                : undefined,
              sourceDesc.value,
              options,
              refs,
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
        result ??= clone(
          target,
          { ...options, preserveDescriptors: true },
          refs,
        );
        Object.defineProperty(result, key, {
          ...sourceDesc,
          value: mergedValue,
        });
      }
    } else if (!targetDesc) {
      result ??= clone(target, { ...options, preserveDescriptors: true }, refs);
      Object.defineProperty(result, key, sourceDesc);
    }
  });

  if (result === null) {
    refs.set(source, target); // [Refs.set]
    return target;
  }

  Object.defineProperties(
    placeholder,
    Object.getOwnPropertyDescriptors(result),
  );

  return placeholder;
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function forEachOwnKey(object: object, fn: (key: string | symbol) => void) {
  for (const key of Object.keys(object)) {
    fn(key);
  }

  const symbols = Object.getOwnPropertySymbols(object);

  for (let i = 0, l = symbols.length; i < l; i++) {
    fn(symbols[i] as symbol);
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
