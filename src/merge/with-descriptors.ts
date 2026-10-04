import {
  clone,
  OWN_DESCS,
  OWN_STRING_KEYS,
  OWN_SYMBOL_KEYS,
} from 'bunshin-clone';
import { merge } from '@/index';
import type { Refs } from '@/ref';
import type {
  GattaiMergeOptions,
  MergePlainObject,
  PlainObject,
} from '@/types';

export function mergeWithDescriptors<
  T extends PlainObject,
  U extends PlainObject,
>(
  target: T,
  source: U,
  settings: GattaiMergeOptions,
  refs: Refs,
): MergePlainObject<T, U> {
  const result: MergePlainObject<T, U> = Object.create(
    Object.getPrototypeOf(target),
  );
  const state = refs.register(source, result);
  const targetDescs = OWN_DESCS(target);
  const sourceDescs = OWN_DESCS(source);
  const updates = new Map<PropertyKey, PropertyDescriptor>();

  function process(key: PropertyKey) {
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
          : clone(sourceValue, settings._clone, refs);
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
  }

  for (const key of OWN_STRING_KEYS(sourceDescs)) {
    process(key);
  }

  if (settings.preserveSymbolKeys) {
    for (const key of OWN_SYMBOL_KEYS(sourceDescs)) {
      process(key);
    }
  }

  if (!updates.size && !state.wasReferenced) {
    refs.resolve(source, target); // [Refs]
    return target as MergePlainObject<T, U>;
  }

  function define(key: string | symbol) {
    const desc = updates.get(key) ?? targetDescs[key];
    desc && defineDescriptor(result, key, desc, settings);
    updates.delete(key);
  }

  for (const key of OWN_STRING_KEYS(targetDescs)) {
    define(key);
  }

  if (settings.preserveSymbolKeys) {
    for (const key of OWN_SYMBOL_KEYS(targetDescs)) {
      define(key);
    }
  }

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
      Object.is(a.value, b.value)
    );
  }

  return a.get === b.get && a.set === b.set;
}
