import { clone, isObject, isPlainObject } from 'bunshin-clone';
import { mergeArray } from '@/merge/array';
import { mergeMap } from '@/merge/map';
import { mergePlainObject } from '@/merge/plain-object';
import { mergeSet } from '@/merge/set';
import { mergeWithDescriptors } from '@/merge/with-descriptors';
import { isGattaiMergeOptions, resolveOptions } from '@/options';
import { Refs } from '@/ref';
import type { GattaiMerge, GattaiMergeOptions, Merge } from '@/types';

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

export function merge<T, U>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): Merge<T, U> {
  // Same
  if (Object.is(target, source)) {
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
    return clone(source, settings._clone, refs) as Merge<T, U>;
  }

  // Primitive
  const isObjectSource = isObject(source);

  if (!isObject(target) || !isObjectSource) {
    return (
      isObjectSource ? clone(source, settings._clone, refs) : source
    ) as Merge<T, U>;
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
    return mergePlainObject(target, source, settings, refs) as Merge<T, U>;
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
  return clone(source, settings._clone, refs) as Merge<T, U>;
}
