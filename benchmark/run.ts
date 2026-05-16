import { Bench } from 'tinybench';

import gattaiMerge from 'gattai-merge';
import merge from 'lodash.merge';
import deepmerge from 'deepmerge';
import { deepmerge as deepmergeTs } from 'deepmerge-ts';
import { produce } from 'immer';

let sink: any;

// --------------------
// 共通表示
// --------------------

function print(bench: Bench) {
  console.table(
    bench.tasks.map((t) => ({
      name: t.name,
      'ops/sec': t.result ? Math.round(t.result.throughput.mean) : 'FAILED',
      '±%': t.result ? t.result.throughput.rme.toFixed(2) : '-',
    })),
  );
}

// --------------------
// 通常比較（軽〜中負荷）
// --------------------

async function run(name: string, a: any, b: any, opts?: any) {
  console.log(`\n=== ${name} ===`);

  const bench = new Bench({
    time: 250,
    warmupTime: 300,
  });

  bench
    .add('gattai-merge', () => {
      sink = gattaiMerge(a, b, opts);
    })
    .add('lodash.merge', () => {
      sink = merge({}, a, b);
    })
    .add('deepmerge', () => {
      sink = deepmerge(a, b);
    })
    .add('deepmerge-ts', () => {
      sink = deepmergeTs(a, b);
    })
    .add('Immer', () => {
      sink = produce(a, (draft) => {
        Object.assign(draft as any, b);
      });
    });

  await bench.run();
  print(bench);
}

// --------------------
// gattaiのみ（機能差）
// --------------------

async function runGattaiOnly(name: string, a: any, b: any, opts?: any) {
  console.log(`\n=== ${name} (gattai only) ===`);

  const bench = new Bench({
    time: 250,
    warmupTime: 200,
  });

  bench.add('gattai-merge', () => {
    sink = gattaiMerge(a, b, opts);
  });

  await bench.run();
  print(bench);
}

// --------------------
// descriptor専用（超重いので別扱い）
// --------------------

async function runDescriptor(name: string, a: any, b: any) {
  console.log(`\n=== ${name} (descriptor) ===`);

  const bench = new Bench({
    iterations: 100, // ←ここ重要（時間ベースNG）
  });

  bench.add('gattai-merge', () => {
    sink = gattaiMerge(a, b, { preserveDescriptors: true });
  });

  await bench.run();
  print(bench);
}

// --------------------
// データ
// --------------------

// basic
const smallA = { a: 1, b: { c: 2 } };
const smallB = { b: { d: 3 } };

const nestedA = {
  a: { b: { c: { d: { e: 1 } } } },
};
const nestedB = {
  a: { b: { c: { d: { f: 2 } } } },
};

const largeA = Object.fromEntries(
  Array.from({ length: 1000 }, (_, i) => [`k${i}`, { v: i }]),
);
const largeB = Object.fromEntries(
  Array.from({ length: 1000 }, (_, i) => [`k${i}`, { v: i + 1 }]),
);

// arrays
const arrA = [1, 2, 3, 4, 5];
const arrB = [6, 7, 8, 9, 10];

const arrLargeA = Array.from({ length: 1000 }, (_, i) => i);
const arrLargeB = Array.from({ length: 1000 }, (_, i) => i + 1);

const mixedA = [1, { a: 1 }, 3, { b: 2 }];
const mixedB = [2, { c: 3 }, 4, { d: 5 }];

// structural
const same = { a: 1, b: { c: 2 } };

const noopA = { a: 1, b: { c: 2 } };
const noopB = { a: 1, b: { c: 2 } };

const nullishA = { a: 1, b: 2 };
const nullishB = { b: null };

// Map / Set
const mapA = new Map([['a', { x: 1 }]]);
const mapB = new Map([['a', { y: 2 }]]);

const setA = new Set([1, 2]);
const setB = new Set([2, 3]);

// descriptor
const descA: any = {};
Object.defineProperty(descA, 'a', {
  value: 1,
  enumerable: false,
});
const descB = { a: 2 };

// wide
const wideA = Object.fromEntries(
  Array.from({ length: 100 }, (_, i) => [`k${i}`, i]),
);
const wideB = Object.fromEntries(
  Array.from({ length: 100 }, (_, i) => [`k${i}`, i + 1]),
);

// --------------------
// 実行
// --------------------

(async () => {
  // 基本
  await run('small', smallA, smallB);
  await run('nested', nestedA, nestedB);
  await run('large', largeA, largeB);

  // array（最重要）
  await run('array: shallow primitive', arrA, arrB, {
    arrays: 'merge',
    nullish: 'strict',
  });

  await run('array: large primitive', arrLargeA, arrLargeB, {
    arrays: 'merge',
    nullish: 'strict',
  });

  await run('array: mixed', mixedA, mixedB);

  // structural
  await run('same reference', same, same);
  await run('no-op', noopA, noopB);

  await run('nullish (loose)', nullishA, nullishB, {
    nullish: 'loose',
  });

  await run('nullish (strict)', nullishA, nullishB, {
    nullish: 'strict',
  });

  // wide
  await run('wide shallow object', wideA, wideB);

  // 機能差
  await runGattaiOnly('Map merge', mapA, mapB);
  await runGattaiOnly('Set merge', setA, setB);

  // descriptor（別枠）
  await runDescriptor('descriptor merge', descA, descB);
})();
