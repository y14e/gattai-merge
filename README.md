# gattai-merge

High-performance deep merge with structural sharing.

## Install

```sh
npm i gattai-merge
```

## Usage

```ts
import { gattaiMerge } from 'gattai-merge';

const result = gattaiMerge(target, [source1, source2, /* ..., */ sourceN], { 
  arrays: 'merge' 
});
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `arrays` | `'replace' \| 'concat' \| 'merge'` | `'replace'` | Array merge strategy. `replace`: overwrite with source. `concat`: append source. `merge`: deep merge by index. |
| `descriptors` | `boolean` | `false` | If `true`, merge property descriptors via `Object.getOwnPropertyDescriptors`. Preserves getters/setters and flags. |

MIT © 2026 Yusuke Kamiyamane
