import type { BunshinCloneOptions } from 'bunshin-clone';
import { isPlainObject } from 'bunshin-clone';
import type {
  ArrayMergeFunction,
  Arrays,
  GattaiMergeOptions,
  Nullish,
} from './types';

export const ARRAYS = ['concat', 'merge', 'replace'] as const;
export const NULLISH = ['loose', 'strict', 'throw'] as const;

export function isGattaiMergeOptions(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (!keys.length) {
    return true;
  }

  return keys.every((key) =>
    [
      'arrays',
      'nullish',
      'preserveDescriptors',
      'preserveSymbolKeys',
      'strictDescriptors',
    ].includes(key),
  );
}

export function resolveOptions(
  options: Partial<GattaiMergeOptions>,
): GattaiMergeOptions {
  let {
    arrays = 'replace',
    nullish = 'loose',
    preserveDescriptors = false,
    preserveSymbolKeys = false,
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

  if (typeof preserveSymbolKeys !== 'boolean') {
    console.warn('Invalid preserveSymbolKeys option. Fallback: false.');
    preserveSymbolKeys = false;
  }

  if (typeof strictDescriptors !== 'boolean') {
    console.warn('Invalid strictDescriptors option. Fallback: false.');
    strictDescriptors = false;
  }

  return {
    arrays,
    nullish,
    preserveDescriptors,
    preserveSymbolKeys,
    strictDescriptors,
  };
}

export function resolveCloneOptions(
  options: GattaiMergeOptions,
): BunshinCloneOptions {
  return {
    preserveBufferSharing: false,
    preserveDescriptors: options.preserveDescriptors,
    preserveSymbolKeys: options.preserveSymbolKeys,
    strictDescriptors: options.strictDescriptors,
  };
}
