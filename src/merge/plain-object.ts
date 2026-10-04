import {
  clone,
  OWN_ENUM_STRING_KEYS,
  OWN_ENUM_SYMBOL_KEYS,
} from 'bunshin-clone';
import { merge } from '@/index';
import type { Refs } from '@/ref';
import type {
  GattaiMergeOptions,
  MergePlainObject,
  PlainObject,
} from '@/types';

export function mergePlainObject<T extends PlainObject, U extends PlainObject>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergePlainObject<T, U> {
  const result: MergePlainObject<T, U> = Object.create(
    Object.getPrototypeOf(target),
  );
  const state = refs.register(source, result);
  let isFinalized = false;

  function process(key: string | symbol) {
    const sourceValue = source[key];

    if (Object.hasOwn(target, key)) {
      const targetValue = target[key];
      const mergedValue = merge(targetValue, sourceValue, settings, refs);

      if (!Object.is(mergedValue, targetValue)) {
        finalize();
        Reflect.set(result, key, mergedValue);
      }

      return;
    }

    finalize();
    Reflect.set(result, key, clone(sourceValue, settings._clone, refs));
  }

  function finalize() {
    if (isFinalized) {
      return;
    }

    isFinalized = true;

    for (const key of OWN_ENUM_STRING_KEYS(target)) {
      Reflect.set(result, key, target[key]);
    }

    if (settings.preserveSymbolKeys) {
      for (const key of OWN_ENUM_SYMBOL_KEYS(target)) {
        Reflect.set(result, key, target[key]);
      }
    }
  }

  for (const key of OWN_ENUM_STRING_KEYS(source)) {
    process(key);
  }

  if (settings.preserveSymbolKeys) {
    for (const key of OWN_ENUM_SYMBOL_KEYS(source)) {
      process(key);
    }
  }

  if (!isFinalized && !state.wasReferenced) {
    refs.resolve(source, target);
    return target as MergePlainObject<T, U>;
  }

  finalize();
  refs.resolve(source, result);
  return result;
}
