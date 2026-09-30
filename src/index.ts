import {
  bunshinClone as clone,
  forEachOwnKey,
  isObject,
  isPlainObject,
  isPrimitiveArray,
  isUnsafeKey,
} from 'bunshin-clone';
import { isGattaiMergeOptions, resolveOptions } from './options';
import { Refs } from './refs';
import type {
  ArrayMergeFunction,
  GattaiMerge,
  GattaiMergeOptions,
  Merge,
  MergeArray,
  MergeMap,
  MergePlainObject,
  MergeSet,
  PlainObject,
} from './types';

export function gattaiMerge<
  T,
  U extends unknown[],
  O extends Partial<GattaiMergeOptions>,
>(target: T, ...args: [...sources: U, options: O]): GattaiMerge<T, U, O>;

export function gattaiMerge<T, U extends unknown[]>(
  target: T,
  ...sources: U
): GattaiMerge<T, U, Record<never, never>>;

export function gattaiMerge(target: unknown, ...args: unknown[]): unknown {
  const { length } = args;
  const last = length ? args[length - 1] : undefined;
  const hasOptions = isGattaiMergeOptions(last);
  const options = (hasOptions ? last : {}) as Partial<GattaiMergeOptions>;
  let result: unknown = target;

  for (let i = 0, l = length - (hasOptions ? 1 : 0); i < l; i++) {
    result = merge(result, args[i], resolveOptions(options), new Refs());
  }

  return result;
}

function merge<T, U>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): Merge<T, U> {
  // Same
  if (isSame(target, source)) {
    return target as Merge<T, U>;
  }

  // Nullish
  if (source == null) {
    const { nullish } = settings;

    if (nullish === 'strict') {
      return source as Merge<T, U>;
    }

    if (nullish === 'throw') {
      throw new TypeError('Source object nullish');
    }

    return target as Merge<T, U>;
  }

  if (target == null) {
    return clone(source, settings, refs) as Merge<T, U>;
  }

  // Primitive
  const isObjectSource = isObject(source);

  if (!isObject(target) || !isObjectSource) {
    return (isObjectSource ? clone(source, settings, refs) : source) as Merge<
      T,
      U
    >;
  }

  // Frozen
  if (Object.isFrozen(target)) {
    throw new TypeError('Target object frozen');
  }

  // [Refs]
  if (refs.has(source)) {
    return refs.get(source) as Merge<T, U>;
  }

  const isMergePlainObject = isPlainObject(target) && isPlainObject(source);

  // With descriptors
  if (settings.preserveDescriptors && isMergePlainObject) {
    return mergeWithDescriptors(target, source, settings, refs) as Merge<T, U>;
  }

  // Array
  if (Array.isArray(target) && Array.isArray(source)) {
    return mergeArray(target, source, settings, refs) as Merge<T, U>;
  }

  // Plain object
  if (isMergePlainObject) {
    return (
      isObjectPrototype(target) && isObjectPrototype(source)
        ? mergePlainObjectFast(target, source, settings, refs)
        : mergePlainObject(target, source, settings, refs)
    ) as Merge<T, U>;
  }

  // Map
  if (target instanceof Map && source instanceof Map) {
    return mergeMap(target, source, settings, refs) as Merge<T, U>;
  }

  // Set
  if (target instanceof Set && source instanceof Set) {
    return mergeSet(target, source, settings, refs) as Merge<T, U>;
  }

  // Fallback: unmergeable types
  return clone(source, settings, refs) as Merge<T, U>;
}

function mergeWithDescriptors<T extends PlainObject, U extends PlainObject>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergePlainObject<T, U> {
  const result: MergePlainObject<T, U> = Object.create(
    Object.getPrototypeOf(target),
  );
  const state = refs.setPlaceholder(source, result);
  const targetDescs = Object.getOwnPropertyDescriptors(target);
  const sourceDescs = Object.getOwnPropertyDescriptors(source);
  const updates = new Map<PropertyKey, PropertyDescriptor>();

  forEachOwnKey(sourceDescs, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }

    const sourceDesc = sourceDescs[key];

    if (!sourceDesc) {
      return;
    }

    const targetDesc = targetDescs[key];

    if ('value' in sourceDesc) {
      const sourceValue = sourceDesc.value;
      const mergedValue =
        targetDesc && 'value' in targetDesc
          ? merge(targetDesc.value, sourceValue, settings, refs)
          : clone(sourceValue, settings, refs);
      const mergedDesc: PropertyDescriptor = {
        ...sourceDesc,
        value: mergedValue,
      };

      if (targetDesc && isSameDescriptor(targetDesc, mergedDesc)) {
        return;
      }

      updates.set(key, mergedDesc);
      return;
    }

    if (targetDesc && isSameDescriptor(targetDesc, sourceDesc)) {
      return;
    }

    updates.set(key, sourceDesc);
  });

  if (!updates.size && !state.referenced) {
    refs.resolve(source, target); // [Refs]
    return target as MergePlainObject<T, U>;
  }

  forEachOwnKey(targetDescs, (key) => {
    const desc = updates.get(key) ?? targetDescs[key];
    desc && defineDescriptor(result, key, desc, settings);
    updates.delete(key);
  });

  for (const [key, desc] of updates) {
    defineDescriptor(result, key, desc, settings);
  }

  refs.resolve(source, result); // [Refs]
  return result;
}

function defineDescriptor(
  target: PlainObject,
  key: PropertyKey,
  desc: PropertyDescriptor,
  settings: GattaiMergeOptions,
): void {
  try {
    Object.defineProperty(target, key, desc);
  } catch (error) {
    if (settings.strictDescriptors) {
      throw error;
    }
  }
}

function isSameDescriptor(
  a: PropertyDescriptor,
  b: PropertyDescriptor,
): boolean {
  if (a.configurable !== b.configurable || a.enumerable !== b.enumerable) {
    return false;
  }

  if ('value' in a || 'value' in b) {
    return (
      'value' in a &&
      'value' in b &&
      a.writable === b.writable &&
      isSame(a.value, b.value)
    );
  }

  return a.get === b.get && a.set === b.set;
}

const BUILTIN_ARRAY_MERGE_FUNCTIONS: Record<
  'concat' | 'merge' | 'replace',
  ArrayMergeFunction
> = {
  concat: (target, source, { clone }) => {
    const result: unknown[] = new Array(target.length + source.length);

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
  replace: (_, source) => source.slice(),
};

function createArrayContext(settings: GattaiMergeOptions, refs: Refs) {
  return {
    clone: (value: unknown) => clone(value, settings, refs),
    merge: (target: unknown, source: unknown) =>
      merge(target, source, settings, refs),
    refs,
    settings,
  };
}

function mergeArray<T extends unknown[], U extends unknown[]>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergeArray<T, U> {
  const { arrays, nullish } = settings;

  if (
    arrays === 'merge' &&
    nullish !== 'loose' &&
    isPrimitiveArray(target) &&
    isPrimitiveArray(source)
  ) {
    return source.slice() as MergeArray<T, U>;
  }

  return (
    typeof arrays === 'string' ? BUILTIN_ARRAY_MERGE_FUNCTIONS[arrays] : arrays
  )(target, source, createArrayContext(settings, refs)) as MergeArray<T, U>;
}

// -----------------------------------------------------------------------------
// Map
// -----------------------------------------------------------------------------

function mergePlainObject<T extends PlainObject, U extends PlainObject>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergePlainObject<T, U> {
  const result = {} as MergePlainObject<T, U>;
  const state = refs.setPlaceholder(source, result);
  let isMaterialized = false;

  function materialize(): void {
    if (isMaterialized) {
      return;
    }

    isMaterialized = true;
    forEachOwnKey(target, (key) => {
      if (typeof key === 'symbol' && !settings.preserveSymbolKeys) {
        return;
      }

      Reflect.set(result, key, target[key]);
    });
  }

  forEachOwnKey(source, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }

    if (typeof key === 'symbol' && !settings.preserveSymbolKeys) {
      return;
    }

    const sourceValue = source[key];

    if (!Object.hasOwn(target, key)) {
      materialize();
      Reflect.set(result, key, clone(sourceValue, settings, refs));
      return;
    }

    const targetValue = target[key];
    const mergedValue = merge(targetValue, sourceValue, settings, refs);

    if (!isSame(mergedValue, targetValue)) {
      materialize();
      Reflect.set(result, key, mergedValue);
    }
  });

  if (!isMaterialized && !state.referenced) {
    refs.resolve(source, target); // [Refs]
    return target as MergePlainObject<T, U>;
  }

  materialize();
  refs.resolve(source, result); // [Refs]
  return result;
}

function mergePlainObjectFast<T extends PlainObject, U extends PlainObject>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergePlainObject<T, U> {
  const result = {} as MergePlainObject<T, U>;
  const state = refs.setPlaceholder(source, result);
  let isMaterialized = false;

  function materialize(): void {
    if (isMaterialized) {
      return;
    }

    isMaterialized = true;

    for (const key in target) {
      Object.hasOwn(target, key) && Reflect.set(result, key, target[key]);
    }

    if (settings.preserveSymbolKeys) {
      for (const key of Object.getOwnPropertySymbols(target)) {
        Object.prototype.propertyIsEnumerable.call(target, key) &&
          Reflect.set(result, key, target[key]);
      }
    }
  }

  if (!settings.preserveSymbolKeys) {
    for (const key in source) {
      if (isUnsafeKey(key) || !Object.hasOwn(source, key)) {
        continue;
      }

      const sourceValue = source[key];

      if (!Object.hasOwn(target, key)) {
        materialize();
        Reflect.set(result, key, clone(sourceValue, settings, refs));
        continue;
      }

      const targetValue = target[key];

      if (isSame(targetValue, sourceValue)) {
        continue;
      }

      if (!isObject(sourceValue) || !isObject(targetValue)) {
        materialize();
        Reflect.set(result, key, sourceValue);
        continue;
      }

      const mergedValue = merge(targetValue, sourceValue, settings, refs);

      if (!isSame(mergedValue, targetValue)) {
        materialize();
        Reflect.set(result, key, mergedValue);
      }
    }
  } else {
    for (const key of Object.getOwnPropertySymbols(source)) {
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) {
        continue;
      }

      const sourceValue = source[key];

      if (!Object.hasOwn(target, key)) {
        materialize();
        Reflect.set(result, key, clone(sourceValue, settings, refs));
        continue;
      }

      const targetValue = target[key];

      if (isSame(targetValue, sourceValue)) {
        continue;
      }

      if (!isObject(sourceValue) || !isObject(targetValue)) {
        materialize();
        Reflect.set(result, key, sourceValue);
        continue;
      }

      const mergedValue = merge(targetValue, sourceValue, settings, refs);

      if (!isSame(mergedValue, targetValue)) {
        materialize();
        Reflect.set(result, key, mergedValue);
      }
    }
  }

  if (!isMaterialized && !state.referenced) {
    refs.resolve(source, target); // [Refs]
    return target as MergePlainObject<T, U>;
  }

  materialize();
  refs.resolve(source, result); // [Refs]
  return result;
}

function mergeMap<
  T extends Map<unknown, unknown>,
  U extends Map<unknown, unknown>,
>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergeMap<T, U> {
  refs.set(source, target); // [Refs]
  let result: Map<unknown, unknown> | null = null;

  for (const [key, sourceValue] of source) {
    if (!target.has(key)) {
      if (result === null) {
        result = new Map(target);
        refs.set(source, result); // [Refs]
      }

      result.set(key, clone(sourceValue, settings, refs));
      continue;
    }

    const targetValue = target.get(key);
    const mergedValue = merge(targetValue, sourceValue, settings, refs);

    if (isSame(mergedValue, targetValue)) {
      continue;
    }

    if (result === null) {
      result = new Map(target);
      refs.set(source, result); // [Refs]
    }

    result.set(key, mergedValue);
  }

  return (result ?? target) as MergeMap<T, U>;
}

function mergeSet<T extends Set<unknown>, U extends Set<unknown>>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergeSet<T, U> {
  const result = new Set<unknown>();

  for (const item of target) {
    result.add(clone(item, settings, refs));
  }

  for (const item of source) {
    result.add(clone(item, settings, refs));
  }

  refs.set(source, result); // [Refs]
  return result as MergeSet<T, U>;
}

function isObjectPrototype(value: unknown): boolean {
  return Object.getPrototypeOf(value) === Object.prototype;
}

function isSame(a: unknown, b: unknown): boolean {
  // biome-ignore lint/suspicious/noSelfCompare: performance optimization
  return a === b || (a !== a && b !== b);
}
