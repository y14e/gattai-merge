# gattai-merge (v3.0.2)

High-performance deep merge with structural sharing. Supports circular ref and complex built-in types.

- ⚡ Fast (copy-on-write, minimal cloning)
- ♻️ Structural sharing (immutable-friendly)
- 🔁 Supports circular ref
- 🧠 Handles Map, Set, Array, TypedArray, Date, RegExp, etc.
- 🧩 Optional descriptor preservation

## Usage

```ts
import gattaiMerge from 'gattai-merge';

const a = { foo: 1, nested: { x: 1 } };
const b = { bar: 2, nested: { x: 1 } };

const result = gattaiMerge(a, b);

console.log(result);
// { foo: 1, bar: 2, nested: { x: 1 } }
```

## API

```ts
gattaiMerge(target, ...sources)
gattaiMerge(target, ...sources, options)
```

## Options

```ts
interface GattaiMergeOptions {
  arrays?: 'replace' | 'concat' | 'merge';
  nullish?: 'loose' | 'strict' | 'throw';
  preserveDescriptors?: boolean;
}
```

`arrays`
- `'replace'` (default): replace target array
- `'concat'`: concatenate arrays
- `'merge'`: deep merge by index

`nullish`
- `'loose'` (default): keep target value if source is nullish
- `'strict'`: overwrite target value if source is nullish
- `'throw'`: throw TypeError if source is nullish

`preserveDescriptors`
 - `true`: preserve property descriptors (getters/setters, etc.)

## Examples

### Array strategies

```ts
gattaiMerge([1, 2], [3, 4]);
// => [3, 4]

gattaiMerge([1, 2], [3, 4], { arrays: 'concat' });
// => [1, 2, 3, 4]

gattaiMerge([{ a: 1 }], [{ b: 2 }], { arrays: 'merge' });
// => [{ a: 1, b: 2 }]
```

### Map / Set

```ts
gattaiMerge(
  new Map([['a', 1]]),
  new Map([['b', 2]])
);
// => Map { 'a' => 1, 'b' => 2 }
```

### Circular ref

```ts
const a: any = {};
a.self = a;

const b = gattaiMerge({}, a);

b.self === b; // true
```

## ⚠️ Structural Sharing & Mutation Caveat

`gattai-merge` is optimized for performance using structural sharing (copy-on-write).
Objects are only cloned when a change is actually required.

### What this implies

If no changes occur during merging, the original `target` object is returned as-is:

```ts
const a = { x: 1 };
const b = { x: 1 };

const result = gattaiMerge(a, b);

result === a; // true
```

### ⚠️ Important

Because the same ref may be returned, mutating the result can also mutate the original input:

```ts
result.x = 2;

console.log(a.x); // 2 (mutated!)
```

### When does this happen?

- When merging produces **no effective changes**
- When merging `Map`, `Set`, or nested structures with identical values
- When structural sharing is preserved for performance

### How to avoid this

If you need a fully immutable result (always a new object), you have a few options:

#### 1. Force a new object

```ts
const result = gattaiMerge({}, a, b);
```

#### 2. Defensive cloning

```ts
const result = gattaiMerge(a, b);
const safe = result === a ? { ...result } : result;
```

### Design note

This behavior is intentional and aligns with libraries like Immer, prioritizing performance by avoiding unnecessary cloning.

If you require strict immutability guarantees, consider wrapping or extending the API to always return a new object.

## Performance

- Avoids unnecessary cloning
- Only clones changed branches
- Comparable or faster than typical deep merge libraries in real-world scenarios
