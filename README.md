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

// CDN
import gattaiMerge from 'https://cdn.jsdelivr.net/npm/gattai-merge/+esm';
```

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
{
  arrays: 'replace';
  nullish: 'loose';
  preserveDescriptors: false;
  strictDescriptors: false;
}
```

**arrays**

* `'replace'`: replace target array (shallow copy)
* `'concat'`: concatenate arrays
* `'merge'`: deep merge by index
* `ArrayMergeFunction`: custom array merge function (advanced usage)

**nullish**

* `'loose'`: keep target value if source is nullish
* `'strict'`: overwrite target value if source is nullish
* `'throw'`: throw TypeError if source is nullish

**preserveDescriptors**

* `false`: use standard merge (faster, ignores property descriptors)
* `true`: preserve property descriptors (getters/setters, etc.)

**strictDescriptors**

* `false`: skip incompatible descriptors
* `true`: throw if descriptor cannot be merged (e.g. non-configurable or non-writable)

--

**🪄 ArrayMergeFunction**
 
```ts
(target, source, {
  merge: (target, source) => {};
  clone: (node) => {};
}) => {};
```

## Examples

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

## Caution

Gattai Merge is optimized for performance using structural sharing (copy-on-write).

Objects are only cloned when a change is actually required.

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

## Performance

* Avoids unnecessary cloning
* Only clones changed branches
* Comparable or faster than typical deep merge libraries in real-world scenarios
