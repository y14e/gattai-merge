import { clone } from 'bunshin-clone';
import { merge } from '@/index';
import type { Refs } from '@/ref';
import type { GattaiMergeOptions, MergeMap } from '@/types';

export function mergeMap<
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
      if (!result) {
        result = new Map(target);
        refs.set(source, result); // [Refs]
      }

      result.set(key, clone(sourceValue, settings._clone, refs));
      continue;
    }

    const targetValue = target.get(key);
    const mergedValue = merge(targetValue, sourceValue, settings, refs);

    if (Object.is(mergedValue, targetValue)) {
      continue;
    }

    if (!result) {
      result = new Map(target);
      refs.set(source, result); // [Refs]
    }

    result.set(key, mergedValue);
  }

  return (result ?? target) as MergeMap<T, U>;
}
