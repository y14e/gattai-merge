# Gattai Merge

High-performance deep merge utility with structural sharing. Supports circular ref and complex built-in types.

* Fast (copy-on-write, minimal cloning)
* Structural sharing (immutable-friendly)
* Supports circular ref
* Handles Map, Set, Array, TypedArray, Date, RegExp, etc.
* Customizable array merge functions
* Optional descriptor preservation

---

## Install

```bash
npm i gattai-merge
```

```ts
// npm
import gattaiMerge from 'gattai-merge';

// CDNs
import gattaiMerge from 'https://esm.sh/gattai-merge'
// or
import gattaiMerge from 'https://cdn.jsdelivr.net/npm/gattai-merge/+esm';
// or
import gattaiMerge from 'https://unpkg.com/gattai-merge/dist/index.js';
```

## Usage

```ts
gattaiMerge(target, ...sources, options)
// => DeepMergedObject<T, S>
// 
// target: T
// ...sources: ...S
// options (optional): GattaiMergeOptions
```

## 🪄 Options

```ts
interface GattaiMergeOptions {
  arrays?: 'replace' | 'concat' | 'merge' | ArrayMergeFunction; // (default: 'replace')
  nullish?: 'loose' | 'strict' | 'throw';                       // (default: 'loose')
  preserveDescriptors?: boolean;                                // (default: false)
  strictDescriptors?: boolean;                                  // (default: false)
}
```

### `arrays`

* `'replace'`: replace target array (shallow copy)
* `'concat'`: concatenate arrays
* `'merge'`: deep merge by index
* `ArrayMergeFunction`: custom array merge function (advanced usage)

#### ⚙️ ArrayMergeFunction
 
```ts
(target, source, {
  merge: (target, source) => {},
  clone: (node) => {},
}) => {};
```

### `nullish`

* `'loose'`: keep target value if source is nullish
* `'strict'`: overwrite target value if source is nullish
* `'throw'`: throw TypeError if source is nullish

### `preserveDescriptors`

If `true`, preserves property descriptors (getters/setters, etc.).

### `strictDescriptors`

If `true`, throws when descriptor cannot be merged (e.g. non-configurable or non-writable).


## 💡 Examples

<details>
<summary>Read more</summary>

### Array

```ts
gattaiMerge([1, 2], [3, 4]);
// => [3, 4]

gattaiMerge([1, 2], [3, 4], { arrays: 'concat' });
// => [1, 2, 3, 4]

gattaiMerge([{ a: 1 }], [{ b: 2 }], { arrays: 'merge' });
// => [{ a: 1, b: 2 }]
```

### Custom array merge function

```ts
gattaiMerge(
  [{ id: 1, value: 'A' }],
  [{ id: 1, value: 'B' }, { id: 2, value: 'C' }],
  {
    // merge items by id
    arrays: (target, source, { merge, clone }) => {
      const map = new Map();

      for (const item of target) {
        map.set(item.id, item);
      }

      for (const item of source) {
        if (map.has(item.id)) {
          map.set(item.id, merge(map.get(item.id), item));
        } else {
          map.set(item.id, clone(item));
        }
      }

      return Array.from(map.values());
    },
  }
);
// => [{ id: 1, value: 'B' }, { id: 2, value: 'C' }]
```

### Map / Set

```ts
gattaiMerge(
  new Map([['a', 1]]),
  new Map([['b', 2]])
);
// => Map { 'a' => 1, 'b' => 2 }
```
</details>

## ⚠️ Caution

Gattai Merge is optimized for performance using structural sharing (copy-on-write). Objects are only cloned when a change is actually required.

<details>
<summary>Read more</summary>
  
### What this implies

If no changes occur during merging, the original target object is returned as-is:

```ts
const a = { x: 1 };
const b = { x: 1 };

const result = gattaiMerge(a, b);

result === a; // true
```

### Important

Because the same ref may be returned, mutating the result can also mutate the original input:

```ts
result.x = 2;

console.log(a.x); // 2 (mutated!)
```

### When does this happen?

* When merging produces **no effective changes**
* When merging Map, Set, or nested structures with identical values
* When structural sharing is preserved for performance

### How to avoid this

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
</details>

## 🚀 Benchmark

```bash
# Install
npm i tsx tinybench gattai-merge lodash.merge deepmerge deepmerge-ts immer

# Run
npx tsx run.ts

# Cleanup
npm un tsx tinybench gattai-merge lodash.merge deepmerge deepmerge-ts immer
```
