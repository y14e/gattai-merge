import { OWN_ENUM_KEYS, OWN_ENUM_STRING_KEYS } from '@y14e/own';
import { clone } from 'bunshin-clone';
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
  const ownKeys = !settings.preserveSymbolKeys
    ? OWN_ENUM_STRING_KEYS
    : OWN_ENUM_KEYS;
  let isCopied = false;

  function copy() {
    if (isCopied) {
      return;
    }

    isCopied = true;

    for (const key of ownKeys(target)) {
      Reflect.set(result, key, target[key]);
    }
  }

  for (const key of ownKeys(source)) {
    const sourceValue = source[key];

    if (Object.hasOwn(target, key)) {
      const targetValue = target[key];
      const mergedValue = merge(targetValue, sourceValue, settings, refs);

      if (!Object.is(mergedValue, targetValue)) {
        copy();
        Reflect.set(result, key, mergedValue);
      }

      continue;
    }

    copy();
    Reflect.set(result, key, clone(sourceValue, settings._clone, refs));
  }

  if (!isCopied && !state.wasReferenced) {
    refs.resolve(source, target);
    return target as MergePlainObject<T, U>;
  }

  copy();
  refs.resolve(source, result);
  return result;
}
