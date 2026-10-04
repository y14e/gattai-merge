import { clone, isPrimitiveArray } from 'bunshin-clone';
import { merge } from '@/index';
import type { Refs } from '@/ref';
import type {
  ArrayMergeFunction,
  GattaiMergeOptions,
  MergeArray,
} from '@/types';

export function mergeArray<T extends unknown[], U extends unknown[]>(
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
    clone: (value: unknown) => clone(value, settings._clone, refs),
    merge: (target: unknown, source: unknown) =>
      merge(target, source, settings, refs),
    refs,
    settings,
  };
}
