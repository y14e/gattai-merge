import type { ARRAYS, NULLISH } from './options';
import type { Refs } from './refs';

export interface GattaiMergeOptions {
  arrays: Arrays;
  nullish: Nullish;
  preserveDescriptors: boolean;
  preserveSymbolKeys: boolean;
  strictDescriptors: boolean;
}

export type Arrays = (typeof ARRAYS)[number] | ArrayMergeFunction;
export type Merge<T, U> = T extends object
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
export type MergeArray<T extends unknown[], U extends unknown[]> = [...T, ...U];
export type MergeMap<T, U> =
  T | U extends Map<infer K, infer V> ? Map<K, V> : never;
export type MergePlainObject<T, U> = Prettify<Omit<T, keyof U> & U>;
export type MergeSet<T, U> = T | U extends Set<infer V> ? Set<V> : never;
export type Nullish = (typeof NULLISH)[number];
export type PlainObject = Record<PropertyKey, unknown>;
type Prettify<T> = { [K in keyof T]: T[K] } & {};
type MergeContext = {
  settings: GattaiMergeOptions;
  refs: Refs;
  merge: (target: unknown, source: unknown) => unknown;
  clone: (value: unknown) => unknown;
};
export type ArrayMergeFunction = (
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
export type GattaiMerge<T, U extends unknown[], O> = U extends [
  infer F,
  ...infer R,
]
  ? GattaiMerge<MergeWithOptions<T, F, O>, R, O>
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
