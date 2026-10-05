import { OWN_DESCS, OWN_KEYS } from '@y14e/own';
import { clone } from 'bunshin-clone';
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
  const changes = new Map<PropertyKey, PropertyDescriptor>();

  for (const key of OWN_KEYS(sourceDescs, settings.preserveSymbolKeys)) {
    const sourceDesc = sourceDescs[key];
    if (!sourceDesc) {
      continue;
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
        continue;
      }

      changes.set(key, mergedDesc);
      continue;
    }

    if (targetDesc && isSameDescriptor(targetDesc, sourceDesc)) {
      continue;
    }

    changes.set(key, sourceDesc);
  }

  if (!changes.size && !state.wasReferenced) {
    refs.resolve(source, target); // [Refs]
    return target as MergePlainObject<T, U>;
  }

  for (const key of OWN_KEYS(targetDescs, settings.preserveSymbolKeys)) {
    const desc = changes.get(key) ?? targetDescs[key];
    desc && Object.defineProperty(result, key, desc);
    changes.delete(key);
  }

  for (const [key, desc] of changes) {
    Object.defineProperty(result, key, desc);
  }

  refs.resolve(source, result); // [Refs]
  return result;
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
