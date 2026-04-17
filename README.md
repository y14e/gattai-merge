# gattai-merge (v2.0.3)

High-performance deep merge with structural sharing. Supports circular ref and complex built-in types.

## Install

```sh
npm i gattai-merge
```

## Usage

```ts
import { gattaiMerge } from 'gattai-merge';

const result = gattaiMerge(target, source1, source2, /* ..., */ sourceN, { 
  arrays: 'merge' 
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `arrays` | `'replace' \| 'concat' \| 'merge'` | `'replace'` | Array merge strategy. `replace`: overwrite with source. `concat`: append source. `merge`: deep merge by index. |
| `preserveDescriptors` | `boolean` | `false` | If `true`, merge property descriptors via `Object.getOwnPropertyDescriptors`. Preserves getters/setters and flags. |

## Performance

| Test | gattai-merge | lodash | deepmerge | Speedup |
|-----------|--------------:|--------:|-----------:|---------|
| **Deep 20 levels** (1K keys) | **5,605 ops/s** | 3,434 ops/s | 3,081 ops/s | **1.63x** |
| **Wide 10K keys** (flat) | **810 ops/s** | 390 ops/s | 346 ops/s | **2.08x** |
| **Large arrays** (10K items) | **204 ops/s** | 121 ops/s | 109 ops/s | **1.69x** |
| **Circular graph** (1K nodes) | **119 ops/s** | N/A | 68 ops/s | **1.75x** |
| **Mega object** (50K nodes) | **29 ops/s** | 14 ops/s | 15 ops/s | **2.07x** |
| **1M keys** (99% unchanged) | **110 ops/s** | 6 ops/s | 6 ops/s | **18.3x** 🚀 |
