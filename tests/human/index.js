// node_modules/bunshin-clone/dist/index.js
var EMPTY_OPTIONS = {};
var { hasOwnProperty: HAS_OWN } = Object.prototype;
function bunshinClone(source, options, refs) {
  return clone(source, options ?? EMPTY_OPTIONS, refs ?? /* @__PURE__ */ new WeakMap());
}
function clone(node, options, refs) {
  if (!isObject(node)) {
    return node;
  }
  const ref = refs.get(node);
  if (ref !== void 0) {
    return ref;
  }
  if (options.preserveDescriptors && isPlainObject(node)) {
    return cloneWithDescriptors(node, options, refs);
  }
  if (Array.isArray(node)) {
    const result = [];
    refs.set(node, result);
    for (let i = 0, l = node.length; i < l; i++) {
      result[i] = clone(node[i], options, refs);
    }
    return result;
  }
  if (isPlainObject(node)) {
    const result = Object.create(Object.getPrototypeOf(node));
    refs.set(node, result);
    for (const key in node) {
      if (!HAS_OWN.call(node, key) || isUnsafeKey(key)) {
        continue;
      }
      result[key] = clone(node[key], options, refs);
    }
    return result;
  }
  if (node instanceof Map) {
    const result = /* @__PURE__ */ new Map();
    refs.set(node, result);
    for (const [key, value] of node) {
      result.set(clone(key, options, refs), clone(value, options, refs));
    }
    return result;
  }
  if (node instanceof Set) {
    const result = /* @__PURE__ */ new Set();
    refs.set(node, result);
    for (const item of node) {
      result.add(clone(item, options, refs));
    }
    return result;
  }
  if (node instanceof Date) {
    const result = new Date(node.getTime());
    refs.set(node, result);
    return result;
  }
  if (node instanceof RegExp) {
    const result = new RegExp(node.source, node.flags);
    refs.set(node, result);
    result.lastIndex = node.lastIndex;
    return result;
  }
  if (node instanceof ArrayBuffer) {
    const result = node.slice(0);
    refs.set(node, result);
    return result;
  }
  if (ArrayBuffer.isView(node)) {
    const { buffer, byteOffset, byteLength } = node;
    if (node instanceof DataView) {
      const result2 = new DataView(buffer.slice(0), byteOffset, byteLength);
      refs.set(node, result2);
      return result2;
    }
    const Ctor = node.constructor;
    const result = new Ctor(buffer.slice(byteOffset, byteOffset + byteLength));
    refs.set(node, result);
    return result;
  }
  if (node instanceof Error || typeof DOMException !== "undefined" && node instanceof DOMException) {
    return cloneError(node, options, refs);
  }
  if (typeof Blob !== "undefined" && node instanceof Blob) {
    const result = node.slice(0, node.size, node.type);
    refs.set(node, result);
    return result;
  }
  if (typeof ImageData !== "undefined" && node instanceof ImageData) {
    const result = new ImageData(
      new Uint8ClampedArray(node.data),
      node.width,
      node.height
    );
    refs.set(node, result);
    return result;
  }
  if (typeof URL !== "undefined" && node instanceof URL) {
    const result = new URL(node.href);
    refs.set(node, result);
    return result;
  }
  if (typeof URLSearchParams !== "undefined" && node instanceof URLSearchParams) {
    const result = new URLSearchParams();
    refs.set(node, result);
    for (const [key, value] of node) {
      result.append(key, value);
    }
    return result;
  }
  refs.set(node, node);
  return node;
}
function cloneError(value, options, refs) {
  if (value instanceof DOMException) {
    const result2 = new DOMException(value.message, value.name);
    refs.set(value, result2);
    return result2;
  }
  const name = value.name || "Error";
  const message = value.message || "";
  let result;
  switch (name) {
    case "EvalError":
      result = new EvalError(message);
      break;
    case "RangeError":
      result = new RangeError(message);
      break;
    case "ReferenceError":
      result = new ReferenceError(message);
      break;
    case "SyntaxError":
      result = new SyntaxError(message);
      break;
    case "TypeError":
      result = new TypeError(message);
      break;
    case "URIError":
      result = new URIError(message);
      break;
    default:
      result = new Error(message);
      result.name = name;
  }
  refs.set(value, result);
  if (value.stack) {
    try {
      result.stack = value.stack;
    } catch {
    }
  }
  if ("cause" in value && value.cause !== void 0) {
    result.cause = clone(value.cause, options, refs);
  }
  for (const key of Object.keys(value)) {
    result[key] = clone(value[key], options, refs);
  }
  return result;
}
function cloneWithDescriptors(node, options, refs) {
  const result = Object.create(Object.getPrototypeOf(node));
  refs.set(node, result);
  const descs = Object.getOwnPropertyDescriptors(node);
  forEachOwnKey(descs, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }
    const desc = { ...descs[key] };
    if ("value" in desc) {
      desc.value = clone(desc.value, options, refs);
    }
    try {
      Object.defineProperty(result, key, desc);
    } catch (error) {
      if (options.strictDescriptors) {
        throw error;
      }
    }
  });
  return result;
}
function forEachOwnKey(object, fn) {
  for (const key of Object.keys(object)) {
    fn(key);
  }
  const symbols = Object.getOwnPropertySymbols(object);
  for (let i = 0, l = symbols.length; i < l; i++) {
    fn(symbols[i]);
  }
}
function isObject(value) {
  return typeof value === "object" && value !== null;
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function isUnsafeKey(key) {
  return typeof key === "string" && (key === "__proto__" || key === "prototype" || key === "constructor");
}

// src/index.ts
var EMPTY_OPTIONS2 = {};
var { hasOwnProperty: HAS_OWN2 } = Object.prototype;
function gattaiMerge(target, ...args) {
  const length = args.length;
  const last = length ? args[length - 1] : void 0;
  const hasOptions = isGattaiMergeOptions(last);
  const options = hasOptions ? last : EMPTY_OPTIONS2;
  let result = target;
  for (let i = 0, l = hasOptions ? length - 1 : length; i < l; i++) {
    result = merge(result, args[i], options, /* @__PURE__ */ new WeakMap());
  }
  return result;
}
function merge(target, source, options, refs) {
  if (isSame(target, source)) {
    return target;
  }
  if (source == null) {
    const nullish = options.nullish ?? "loose";
    if (nullish === "strict") {
      return source;
    }
    if (nullish === "throw") {
      throw new TypeError("Source object nullish");
    }
    return target;
  }
  if (target == null) {
    return bunshinClone(source, options, refs);
  }
  const isObjectSource = isObject2(source);
  if (!isObject2(target) || !isObjectSource) {
    return isObjectSource ? bunshinClone(source, options, refs) : source;
  }
  if (Object.isFrozen(target)) {
    throw new TypeError("Target object frozen");
  }
  const ref = refs.get(source);
  if (ref !== void 0) {
    return ref;
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    return mergeArray(target, source, options, refs);
  }
  if (target instanceof Map && source instanceof Map) {
    return mergeMap(target, source, options, refs);
  }
  if (target instanceof Set && source instanceof Set) {
    const result = /* @__PURE__ */ new Set();
    refs.set(source, result);
    for (const item of target) {
      result.add(bunshinClone(item, options, refs));
    }
    for (const item of source) {
      result.add(bunshinClone(item, options, refs));
    }
    return result;
  }
  if (isPlainObject2(target) && isPlainObject2(source)) {
    if (!options.preserveDescriptors) {
      if (isObjectPrototype(target) && isObjectPrototype(source)) {
        return mergePlainObjectFast(
          target,
          source,
          options,
          refs
        );
      }
      return mergePlainObject(
        target,
        source,
        options,
        refs
      );
    }
    return mergeWithDescriptors(
      target,
      source,
      options,
      refs
    );
  }
  return bunshinClone(source, options, refs);
}
function mergePlainObject(target, source, options, refs) {
  refs.set(source, target);
  let targetKeys = null;
  let result = null;
  const proto = Object.getPrototypeOf(target);
  function ensure() {
    result = Object.create(proto);
    targetKeys ??= Object.keys(target);
    for (let i = 0, l = targetKeys.length; i < l; i++) {
      const key = targetKeys[i];
      result[key] = target[key];
    }
    refs.set(source, result);
  }
  forEachOwnKey2(source, (sourceKey) => {
    if (isUnsafeKey2(sourceKey)) {
      return;
    }
    const targetValue = target[sourceKey];
    const sourceValue = source[sourceKey];
    if (HAS_OWN2.call(target, sourceKey)) {
      const mergedValue = merge(targetValue, sourceValue, options, refs);
      if (!isSame(mergedValue, targetValue)) {
        result === null && ensure();
        result[sourceKey] = mergedValue;
      }
    } else {
      result === null && ensure();
      result[sourceKey] = bunshinClone(sourceValue, options, refs);
    }
  });
  return result ?? target;
}
function mergePlainObjectFast(target, source, options, refs) {
  refs.set(source, target);
  let result = null;
  for (const key in source) {
    if (!HAS_OWN2.call(source, key) || isUnsafeKey2(key)) {
      continue;
    }
    const targetValue = target[key];
    const sourceValue = source[key];
    if (targetValue === sourceValue) {
      continue;
    }
    if (!HAS_OWN2.call(target, key)) {
      if (result === null) {
        result = { ...target };
        refs.set(source, result);
      }
      result[key] = bunshinClone(sourceValue, options, refs);
      continue;
    }
    if (sourceValue === null || typeof sourceValue !== "object" || targetValue === null || typeof targetValue !== "object") {
      if (result === null) {
        result = { ...target };
        refs.set(source, result);
      }
      result[key] = sourceValue;
      continue;
    }
    const mergedValue = merge(targetValue, sourceValue, options, refs);
    if (mergedValue !== targetValue) {
      if (result === null) {
        result = { ...target };
        refs.set(source, result);
      }
      result[key] = mergedValue;
    }
  }
  return result ?? target;
}
var BUILTIN_ARRAY_MERGE_FUNCTIONS = {
  replace: (_, source) => source.slice(),
  concat: (target, source, { clone: clone2 }) => {
    const result = new Array(target.length + source.length);
    for (let i = 0, l = target.length; i < l; i++) {
      result[i] = target[i];
    }
    for (let i = 0, l = source.length; i < l; i++) {
      result[target.length + i] = clone2(source[i]);
    }
    return result;
  },
  merge: (target, source, { merge: merge2, clone: clone2 }) => {
    let result = null;
    for (let i = 0, l = Math.max(target.length, source.length); i < l; i++) {
      const targetValue = target[i];
      const sourceValue = source[i];
      const mergedValue = i in source ? i in target ? merge2(targetValue, sourceValue) : clone2(sourceValue) : targetValue;
      if (result === null && mergedValue !== targetValue) {
        result = [...target];
      }
      if (result) {
        result[i] = mergedValue;
      }
    }
    return result ?? target;
  }
};
function createArrayContext(options, ref) {
  return {
    options,
    ref,
    merge: (target, source) => merge(target, source, options, ref),
    clone: (node) => bunshinClone(node, options, ref)
  };
}
function mergeArray(target, source, options, ref) {
  const arrays = options.arrays ?? "replace";
  const nullish = options.nullish ?? "loose";
  if (arrays === "merge" && nullish !== "loose" && isShallowArray(target) && isShallowArray(source)) {
    return source.slice();
  }
  return (typeof arrays !== "function" ? BUILTIN_ARRAY_MERGE_FUNCTIONS[arrays] : arrays)(target, source, createArrayContext(options, ref));
}
function mergeMap(target, source, options, refs) {
  refs.set(source, target);
  let result = null;
  for (const [key, sourceValue] of source) {
    if (!target.has(key)) {
      if (result === null) {
        result = new Map(target);
        refs.set(source, result);
      }
      result.set(key, bunshinClone(sourceValue, options, refs));
      continue;
    }
    const targetValue = target.get(key);
    const mergedValue = merge(targetValue, sourceValue, options, refs);
    if (!isSame(mergedValue, targetValue)) {
      if (result === null) {
        result = new Map(target);
        refs.set(source, result);
      }
      result.set(key, mergedValue);
    }
  }
  return result ?? target;
}
function mergeWithDescriptors(target, source, options, refs) {
  const placeholder = Object.create(Object.getPrototypeOf(target));
  refs.set(source, placeholder);
  const targetDescs = Object.getOwnPropertyDescriptors(target);
  const sourceDescs = Object.getOwnPropertyDescriptors(source);
  let result = null;
  forEachOwnKey2(sourceDescs, (key) => {
    if (isUnsafeKey2(key)) {
      return;
    }
    const targetDesc = targetDescs[key];
    const sourceDesc = sourceDescs[key];
    if ("value" in sourceDesc) {
      const mergedValue = targetDesc === void 0 || !("value" in targetDesc) ? bunshinClone(sourceDesc.value, options, refs) : merge(
        targetDesc && "value" in targetDesc ? targetDesc.value : void 0,
        sourceDesc.value,
        options,
        refs
      );
      if (targetDesc && (targetDesc.configurable === false || "value" in targetDesc && targetDesc.writable === false && !isSame(mergedValue, targetDesc.value))) {
        if (options.strictDescriptors) {
          throw new TypeError(
            `Cannot merge descriptor for key ${String(key)}: configurable=${targetDesc.configurable}, writable=${"value" in targetDesc ? targetDesc.writable : "N/A"}`
          );
        }
        return;
      }
      if (!targetDesc || !("value" in targetDesc) || !isSame(mergedValue, targetDesc.value)) {
        result ??= bunshinClone(
          target,
          { ...options, preserveDescriptors: true },
          refs
        );
        Object.defineProperty(result, key, {
          ...sourceDesc,
          value: mergedValue
        });
      }
    } else if (!targetDesc) {
      result ??= bunshinClone(target, { ...options, preserveDescriptors: true }, refs);
      Object.defineProperty(result, key, sourceDesc);
    }
  });
  if (result === null) {
    refs.set(source, target);
    return target;
  }
  Object.defineProperties(
    placeholder,
    Object.getOwnPropertyDescriptors(result)
  );
  return placeholder;
}
function forEachOwnKey2(object, fn) {
  for (const key of Object.keys(object)) {
    fn(key);
  }
  const symbols = Object.getOwnPropertySymbols(object);
  for (let i = 0, l = symbols.length; i < l; i++) {
    fn(symbols[i]);
  }
}
function isGattaiMergeOptions(value) {
  if (!isPlainObject2(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return true;
  }
  return keys.every(
    (key) => key === "arrays" || key === "nullish" || key === "preserveDescriptors" || key === "strictDescriptors"
  );
}
function isObject2(value) {
  return typeof value === "object" && value !== null;
}
function isObjectPrototype(value) {
  return Object.getPrototypeOf(value) === Object.prototype;
}
function isPlainObject2(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function isSame(a, b) {
  return a === b || a !== a && b !== b;
}
function isShallowArray(array) {
  for (let i = 0, l = array.length; i < l; i++) {
    if (isObject2(array[i])) {
      return false;
    }
  }
  return true;
}
function isUnsafeKey2(key) {
  return typeof key === "string" && (key === "__proto__" || key === "prototype" || key === "constructor");
}
/**
 * Gattai Merge
 * High-performance deep merge utility with structural sharing.
 * Supports circular ref and complex built-in types.
 *
 * @version 3.4.1
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/gattai-merge}
 */
/*! Bundled license information:

bunshin-clone/dist/index.js:
  (**
   * Bunshin Clone
   * High-performance deep clone utility with descriptor support.
   * Handles circular ref and complex built-in types.
   *
   * @version 1.2.1
   * @author Yusuke Kamiyamane
   * @license MIT
   * @copyright Copyright (c) Yusuke Kamiyamane
   * @see {@link https://github.com/y14e/bunshin-clone}
   *)
*/

export { gattaiMerge as default };
