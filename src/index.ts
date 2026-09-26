// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import {
  bunshinClone as clone,
  forEachOwnKey,
  isObject,
  isPlainObject,
  isUnsafeKey,
} from 'bunshin-clone';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GattaiMergeOptions {
  arrays: Arrays;
  nullish: Nullish;
  preserveDescriptors: boolean;
  strictDescriptors: boolean;
}

type Arrays = (typeof ARRAYS)[number] | ArrayMergeFunction;
type Merge<T, U> = T extends object
  ? U extends object
    ? T extends unknown[]
      ? U extends unknown[]
        ? MergeArray<T, U>
        : U
      : T extends PlainObject
        ? U extends PlainObject
          ? MergePlainObject<T, U>
          : U
        : T extends Map<unknown, unknown>
          ? U extends Map<unknown, unknown>
            ? MergeMap<T, U>
            : U
          : T extends Set<unknown>
            ? U extends Set<unknown>
              ? MergeSet<T, U>
              : U
            : U
    : U
  : U;
type MergeArray<T extends unknown[], U extends unknown[]> = [...T, ...U];
type MergeMap<T, U> = T | U extends Map<infer K, infer V> ? Map<K, V> : never;
type MergePlainObject<T, U> = Prettify<Omit<T, keyof U> & U>;
type MergeSet<T, U> = T | U extends Set<infer V> ? Set<V> : never;
type Nullish = (typeof NULLISH)[number];
type PlainObject = Record<PropertyKey, unknown>;
type Prettify<T> = { [K in keyof T]: T[K] } & {};
type RefState = { referenced: boolean };
type MergeContext = {
  settings: GattaiMergeOptions;
  refs: Refs;
  merge: (target: unknown, source: unknown) => unknown;
  clone: (value: unknown) => unknown;
};
type ArrayMergeFunction = (
  target: unknown[],
  source: unknown[],
  context: MergeContext,
) => unknown[];

type ArrayOption<O> = 'arrays' extends keyof O
  ? O extends { arrays: infer A }
    ? A
    : O extends { arrays?: infer A }
      ? Exclude<A, undefined> | 'replace'
      : 'replace'
  : 'replace';
type NullishOption<O> = 'nullish' extends keyof O
  ? O extends { nullish: infer N }
    ? N
    : O extends { nullish?: infer N }
      ? Exclude<N, undefined> | 'loose'
      : 'loose'
  : 'loose';
type MergeWithOptions<T, U, O> = U extends null | undefined
  ? MergeNullish<T, U, NullishOption<O>>
  : T extends object
    ? U extends object
      ? T extends unknown[]
        ? U extends unknown[]
          ? MergeArrayWithOptions<T, U, O>
          : U
        : T extends PlainObject
          ? U extends PlainObject
            ? MergePlainObjectWithOptions<T, U, O>
            : U
          : T extends Map<unknown, unknown>
            ? U extends Map<unknown, unknown>
              ? MergeMap<T, U>
              : U
            : T extends Set<unknown>
              ? U extends Set<unknown>
                ? MergeSet<T, U>
                : U
              : U
      : U
    : U;
type MergeAllWithOptions<T, U extends unknown[], O> = U extends [
  infer F,
  ...infer R,
]
  ? MergeAllWithOptions<MergeWithOptions<T, F, O>, R, O>
  : T;
type MergeArrayWithOptions<
  T extends unknown[],
  U extends unknown[],
  O,
> = MergeArrayByStrategy<T, U, O, ArrayOption<O>>;
type MergeArrayByStrategy<
  T extends unknown[],
  U extends unknown[],
  O,
  A,
> = A extends 'concat'
  ? MergeArrayConcat<T, U>
  : A extends 'merge'
    ? MergeArrayByIndex<T, U, O>
    : A extends 'replace'
      ? U
      : A extends ArrayMergeFunction
        ? ReturnType<A>
        : U;
type MergeArrayConcat<T extends unknown[], U extends unknown[]> = number extends
  | T['length']
  | U['length']
  ? Array<T[number] | U[number]>
  : [...T, ...U];
type MergeArrayByIndex<
  T extends unknown[],
  U extends unknown[],
  O,
> = number extends T['length'] | U['length']
  ? Array<T[number] | U[number] | MergeWithOptions<T[number], U[number], O>>
  : T extends [infer TF, ...infer TR]
    ? U extends [infer UF, ...infer UR]
      ? [MergeWithOptions<TF, UF, O>, ...MergeArrayByIndex<TR, UR, O>]
      : T
    : U;
type MergeNullish<T, U, N> = N extends 'strict'
  ? U
  : N extends 'throw'
    ? never
    : T;
type MergePlainObjectWithOptions<T, U, O> = Prettify<
  Omit<T, keyof U> & {
    [K in keyof U]: K extends keyof T ? MergeWithOptions<T[K], U[K], O> : U[K];
  }
>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const EMPTY_OPTIONS = {};
const { hasOwnProperty: HAS_OWN } = Object.prototype;
const ARRAYS = ['concat', 'merge', 'replace'] as const;
const NULLISH = ['loose', 'strict', 'throw'] as const;

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

export function gattaiMerge<
  T,
  U extends unknown[],
  O extends Partial<GattaiMergeOptions>,
>(
  target: T,
  ...args: [...sources: U, options: O]
): MergeAllWithOptions<T, U, O>;

export function gattaiMerge<T, U extends unknown[]>(
  target: T,
  ...sources: U
): MergeAllWithOptions<T, U, Record<never, never>>;

export function gattaiMerge(target: unknown, ...args: unknown[]): unknown {
  const { length } = args;
  const last = length ? args[length - 1] : undefined;
  const hasOptions = isGattaiMergeOptions(last);
  const options = (
    hasOptions ? last : EMPTY_OPTIONS
  ) as Partial<GattaiMergeOptions>;
  let result: unknown = target;

  for (let i = 0, l = length - (hasOptions ? 1 : 0); i < l; i++) {
    result = merge(result, args[i], resolveOptions(options), new Refs());
  }

  return result;
}

class Refs extends WeakMap<object, unknown> {
  #states = new WeakMap<object, RefState>();

  override get(key: object): unknown {
    const state = this.#states.get(key);
    const value = super.get(key);

    if (state && value !== undefined) {
      state.referenced = true;
    }

    return value;
  }

  resolve(key: object, value: unknown): void {
    this.#states.delete(key);
    super.set(key, value);
  }

  setPlaceholder(key: object, value: unknown): RefState {
    const state = { referenced: false };
    super.set(key, value);
    this.#states.set(key, state);
    return state;
  }
}

// -----------------------------------------------------------------------------
// Core
// -----------------------------------------------------------------------------

function merge<T, S>(
  target: T,
  source: S,
  settings: GattaiMergeOptions,
  refs: Refs,
): Merge<T, S> {
  // Same
  if (isSame(target, source)) {
    return target as Merge<T, S>;
  }

  // Nullish
  if (source == null) {
    const { nullish } = settings;

    if (nullish === 'strict') {
      return source as Merge<T, S>;
    }

    if (nullish === 'throw') {
      throw new TypeError('Source object nullish');
    }

    return target as Merge<T, S>;
  }

  if (target == null) {
    return clone(source, settings, refs) as Merge<T, S>;
  }

  // Primitive
  const isObjectSource = isObject(source);

  if (!isObject(target) || !isObjectSource) {
    return (isObjectSource ? clone(source, settings, refs) : source) as Merge<
      T,
      S
    >;
  }

  // Frozen
  if (Object.isFrozen(target)) {
    throw new TypeError('Target object frozen');
  }

  // [Refs]
  if (refs.has(source)) {
    return refs.get(source) as Merge<T, S>;
  }

  // Array
  if (Array.isArray(target) && Array.isArray(source)) {
    return mergeArray(target, source, settings, refs) as Merge<T, S>;
  }

  // Plain object
  if (isPlainObject(target) && isPlainObject(source)) {
    if (!settings.preserveDescriptors) {
      return (
        isObjectPrototype(target) && isObjectPrototype(source)
          ? mergePlainObjectFast(target, source, settings, refs)
          : mergePlainObject(target, source, settings, refs)
      ) as Merge<T, S>;
    }

    // With descriptors
    return mergeWithDescriptors(target, source, settings, refs) as Merge<T, S>;
  }

  // Map
  if (target instanceof Map && source instanceof Map) {
    return mergeMap(target, source, settings, refs) as Merge<T, S>;
  }

  // Set
  if (target instanceof Set && source instanceof Set) {
    return mergeSet(target, source, settings, refs) as Merge<T, S>;
  }

  // Fallback: unmergeable types
  return clone(source, settings, refs) as Merge<T, S>;
}

// -----------------------------------------------------------------------------
// Array
// -----------------------------------------------------------------------------

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
    isShallowArray(target) &&
    isShallowArray(source)
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

// -----------------------------------------------------------------------------
// Plain object
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
    forEachOwnKey(target, (key) => Reflect.set(result, key, target[key]));
  }

  forEachOwnKey(source, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }

    const sourceValue = source[key];

    if (!HAS_OWN.call(target, key)) {
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
      HAS_OWN.call(target, key) && Reflect.set(result, key, target[key]);
    }
  }

  for (const key in source) {
    if (!HAS_OWN.call(source, key) || isUnsafeKey(key)) {
      continue;
    }

    const sourceValue = source[key];

    if (!HAS_OWN.call(target, key)) {
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

  if (!isMaterialized && !state.referenced) {
    refs.resolve(source, target); // [Refs]
    return target as MergePlainObject<T, U>;
  }

  materialize();
  refs.resolve(source, result); // [Refs]
  return result;
}

// -----------------------------------------------------------------------------
// Set
// -----------------------------------------------------------------------------

function mergeSet<T extends Set<unknown>, U extends Set<unknown>>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergeSet<T, U> {
  const result = new Set<unknown>();
  refs.set(source, result); // [Refs]

  for (const item of target) {
    result.add(clone(item, settings, refs));
  }

  for (const item of source) {
    result.add(clone(item, settings, refs));
  }

  return result as MergeSet<T, U>;
}

// -----------------------------------------------------------------------------
// With descriptors
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function isGattaiMergeOptions(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (!keys.length) {
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

function isObjectPrototype(value: unknown): boolean {
  return Object.getPrototypeOf(value) === Object.prototype;
}

function isSame(a: unknown, b: unknown): boolean {
  // biome-ignore lint/suspicious/noSelfCompare: performance optimization
  return a === b || (a !== a && b !== b);
}

function isShallowArray(array: unknown[]): boolean {
  for (let i = 0, l = array.length; i < l; i++) {
    if (isObject(array[i])) {
      return false;
    }
  }

  return true;
}

function resolveOptions(
  options: Partial<GattaiMergeOptions>,
): GattaiMergeOptions {
  let {
    arrays = 'replace',
    nullish = 'loose',
    preserveDescriptors = false,
    strictDescriptors = false,
  } = options;

  let hasError = false;

  if (typeof arrays === 'string') {
    arrays = arrays.toLowerCase() as Exclude<Arrays, ArrayMergeFunction>;

    if (!ARRAYS.includes(arrays)) {
      hasError = true;
    }
  } else if (typeof arrays !== 'function') {
    hasError = true;
  }

  if (hasError) {
    console.warn("Invalid arrays option. Fallback: 'replace'.");
    arrays = 'replace';
  }

  nullish = nullish.toLowerCase() as Nullish;

  if (!NULLISH.includes(nullish)) {
    console.warn("Invalid nullish option. Fallback: 'loose'.");
    nullish = 'loose';
  }

  if (typeof preserveDescriptors !== 'boolean') {
    console.warn('Invalid preserveDescriptors option. Fallback: false.');
    preserveDescriptors = false;
  }

  if (typeof strictDescriptors !== 'boolean') {
    console.warn('Invalid strictDescriptors option. Fallback: false.');
    strictDescriptors = false;
  }

  return { arrays, nullish, preserveDescriptors, strictDescriptors };
}
