import { clone } from 'bunshin-clone';
import type { Refs } from '@/ref';
import type { GattaiMergeOptions, MergeSet } from '@/types';

export function mergeSet<T extends Set<unknown>, U extends Set<unknown>>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergeSet<T, U> {
  const result = new Set<unknown>();

  for (const item of target) {
    result.add(clone(item, settings._clone, refs));
  }

  for (const item of source) {
    result.add(clone(item, settings._clone, refs));
  }

  refs.set(source, result); // [Refs]
  return result as MergeSet<T, U>;
}
