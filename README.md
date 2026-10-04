# Gattai Merge

High-performance deep merge utility with structural sharing. Supports circular ref and complex built-in types.

## Install

```bash
npm i gattai-merge
```

```ts
// npm
import { gattaiMerge } from 'gattai-merge';

// CDNs
import { gattaiMerge } from 'https://esm.sh/gattai-merge@<x.x.x>';
// or
import { gattaiMerge } from 'https://cdn.jsdelivr.net/npm/gattai-merge@<x.x.x>/+esm';
// or
import { gattaiMerge } from 'https://esm.unpkg.com/gattai-merge@<x.x.x>';
```

## 📦 APIs

```ts
gattaiMerge<T, U, O>(target, ...sources, options)
// => GattaiMerge<T, U, O>
//
// target: T
// ...sources: U
// options (optional): GattaiMergeOptions (O)
```

## 🪄 Options

```ts
interface GattaiMergeOptions {
  arrays: 'concat' | 'merge' | 'replace' | ArrayMergeFunction; // default: 'replace'
  nullish: 'loose' | 'strict' | 'throw';                       // default: 'loose'
  preserveDescriptors: boolean;                                // default: false
  preserveSymbolKeys: boolean;                                 // default: false
  strictDescriptors: boolean;                                  // default: false
}
```

### `arrays`

- `'concat'`: concatenate arrays
- `'merge'`: deep merge by index
- `'replace'`: replace target array (shallow copy)
- `ArrayMergeFunction`: custom array merge function (advanced usage)

#### ⚙️ ArrayMergeFunction

```ts
(target, source, {
  merge: (target, source) => {},
  clone: (node) => {},
}) => {};
```

### `nullish`

- `'loose'`: keep target value if source is nullish
- `'strict'`: overwrite target value if source is nullish
- `'throw'`: throw TypeError if source is nullish

### `preserveDescriptors`

If `true`, preserves property descriptors, including non-enumerable properties.

### `preserveSymbolKeys`

If `true`, preserves symbol keys (slower).
