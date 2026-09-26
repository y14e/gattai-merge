// node_modules/bunshin-clone/dist/index.js
var EMPTY_OPTIONS = {};
function bunshinClone(value, options = EMPTY_OPTIONS, refs = /* @__PURE__ */ new WeakMap()) {
  return clone(value, resolveOptions(options), refs);
}
function clone(value, settings, refs) {
  if (!isObject(value)) {
    return value;
  }
  if (refs.has(value)) {
    return refs.get(value);
  }
  if (settings.preserveDescriptors && isPlainObject(value)) {
    return cloneWithDescriptors(value, settings, refs);
  }
  if (Array.isArray(value)) {
    const { length } = value;
    const result = new Array(length);
    refs.set(value, result);
    for (let i = 0; i < length; i++) {
      result[i] = clone(value[i], settings, refs);
    }
    return result;
  }
  if (isPlainObject(value)) {
    const result = Object.create(Object.getPrototypeOf(value));
    refs.set(value, result);
    for (const key of Reflect.ownKeys(value)) {
      if (!isUnsafeKey(key) && Object.prototype.propertyIsEnumerable.call(value, key)) {
        result[key] = clone(value[key], settings, refs);
      }
    }
    return result;
  }
  if (value instanceof Map) {
    const result = /* @__PURE__ */ new Map();
    refs.set(value, result);
    for (const [key, v] of value) {
      result.set(clone(key, settings, refs), clone(v, settings, refs));
    }
    return result;
  }
  if (value instanceof Set) {
    const result = /* @__PURE__ */ new Set();
    refs.set(value, result);
    for (const item of value) {
      result.add(clone(item, settings, refs));
    }
    return result;
  }
  if (value instanceof Date) {
    const result = new Date(value.getTime());
    refs.set(value, result);
    return result;
  }
  if (value instanceof RegExp) {
    const result = new RegExp(value.source, value.flags);
    refs.set(value, result);
    result.lastIndex = value.lastIndex;
    return result;
  }
  if (value instanceof ArrayBuffer) {
    const result = value.slice(0);
    refs.set(value, result);
    return result;
  }
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) {
      const { buffer: buffer2, byteOffset: byteOffset2, byteLength } = value;
      const result2 = new DataView(
        cloneBuffer(buffer2, refs),
        byteOffset2,
        byteLength
      );
      refs.set(value, result2);
      return result2;
    }
    const view = value;
    if (!settings.preserveBufferSharing) {
      const Ctor2 = view.constructor;
      const result2 = new Ctor2(view);
      refs.set(value, result2);
      return result2;
    }
    const Ctor = view.constructor;
    const { buffer, byteOffset, length } = view;
    const result = new Ctor(cloneBuffer(buffer, refs), byteOffset, length);
    refs.set(value, result);
    return result;
  }
  if (value instanceof DOMException || value instanceof Error) {
    return cloneError(value, settings, refs);
  }
  if (value instanceof Blob) {
    const result = value.slice(0, value.size, value.type);
    refs.set(value, result);
    return result;
  }
  if (typeof ImageData !== "undefined" && value instanceof ImageData) {
    const { data, width, height, colorSpace } = value;
    const result = new ImageData(new Uint8ClampedArray(data), width, height, {
      colorSpace
    });
    refs.set(value, result);
    return result;
  }
  if (value instanceof URL) {
    const result = new URL(value.href);
    refs.set(value, result);
    return result;
  }
  if (value instanceof URLSearchParams) {
    const result = new URLSearchParams();
    refs.set(value, result);
    for (const [key, v] of value) {
      result.append(key, v);
    }
    return result;
  }
  refs.set(value, value);
  return value;
}
function cloneBuffer(buffer, refs) {
  if (refs.has(buffer)) {
    return refs.get(buffer);
  }
  const result = buffer.slice(0);
  refs.set(buffer, result);
  return result;
}
function cloneError(error, settings, refs) {
  const result = createErrorInstance(error, settings, refs);
  refs.set(error, result);
  if (error instanceof DOMException) {
    return result;
  }
  const { stack, cause } = error;
  if (stack) {
    try {
      result.stack = stack;
    } catch {
    }
  }
  if ("cause" in error && cause !== void 0) {
    result.cause = clone(cause, settings, refs);
  }
  for (const key of Object.keys(error)) {
    Reflect.set(result, key, clone(Reflect.get(error, key), settings, refs));
  }
  return result;
}
function cloneWithDescriptors(object, settings, refs) {
  const result = Object.create(Object.getPrototypeOf(object));
  refs.set(object, result);
  const descs = Object.getOwnPropertyDescriptors(object);
  forEachOwnKey(descs, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }
    const desc = { ...descs[key] };
    if ("value" in desc) {
      desc.value = clone(desc.value, settings, refs);
    }
    try {
      Object.defineProperty(result, key, desc);
    } catch (error) {
      if (settings.strictDescriptors) {
        throw error;
      }
    }
  });
  return result;
}
var ERROR_CTORS = {
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError
};
function createErrorInstance(error, settings, refs) {
  const { message, name } = error;
  if (error instanceof DOMException) {
    return new DOMException(message, name);
  }
  if (error instanceof AggregateError) {
    return new AggregateError(
      error.errors.map((e) => clone(e, settings, refs)),
      message
    );
  }
  const Ctor = ERROR_CTORS[name];
  if (Ctor) {
    return new Ctor(message);
  }
  const result = new Error(message);
  result.name = name;
  return result;
}
function forEachOwnKey(object, callback) {
  for (const key of Object.keys(object)) {
    callback(key);
  }
  for (const symbol of Object.getOwnPropertySymbols(object)) {
    callback(symbol);
  }
}
function isObject(value) {
  return typeof value === "object" && value !== null;
}
function isPlainObject(value) {
  if (!isObject(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function isUnsafeKey(key) {
  return typeof key === "string" && (key === "__proto__" || key === "prototype" || key === "constructor");
}
function resolveOptions(options) {
  let {
    preserveBufferSharing = false,
    preserveDescriptors = false,
    strictDescriptors = false
  } = options;
  if (typeof preserveBufferSharing !== "boolean") {
    console.warn("Invalid preserveBufferSharing option. Fallback: false.");
    preserveBufferSharing = false;
  }
  if (typeof preserveDescriptors !== "boolean") {
    console.warn("Invalid preserveDescriptors option. Fallback: false.");
    preserveDescriptors = false;
  }
  if (typeof strictDescriptors !== "boolean") {
    console.warn("Invalid strictDescriptors option. Fallback: false.");
    strictDescriptors = false;
  }
  return { preserveBufferSharing, preserveDescriptors, strictDescriptors };
}

// src/index.ts
var EMPTY_OPTIONS2 = {};
var { hasOwnProperty: HAS_OWN } = Object.prototype;
var ARRAYS = ["concat", "merge", "replace"];
var NULLISH = ["loose", "strict", "throw"];
function gattaiMerge(target, ...args) {
  const { length } = args;
  const last = length ? args[length - 1] : void 0;
  const hasOptions = isGattaiMergeOptions(last);
  const options = hasOptions ? last : EMPTY_OPTIONS2;
  let result = target;
  for (let i = 0, l = length - (hasOptions ? 1 : 0); i < l; i++) {
    result = merge(result, args[i], resolveOptions2(options), new Refs());
  }
  return result;
}
var Refs = class extends WeakMap {
  #states = /* @__PURE__ */ new WeakMap();
  get(key) {
    const state = this.#states.get(key);
    const value = super.get(key);
    if (state && value !== void 0) {
      state.referenced = true;
    }
    return value;
  }
  resolve(key, value) {
    this.#states.delete(key);
    super.set(key, value);
  }
  setPlaceholder(key, value) {
    const state = { referenced: false };
    super.set(key, value);
    this.#states.set(key, state);
    return state;
  }
};
function merge(target, source, settings, refs) {
  if (isSame(target, source)) {
    return target;
  }
  if (source == null) {
    const { nullish } = settings;
    if (nullish === "strict") {
      return source;
    }
    if (nullish === "throw") {
      throw new TypeError("Source object nullish");
    }
    return target;
  }
  if (target == null) {
    return bunshinClone(source, settings, refs);
  }
  const isObjectSource = isObject(source);
  if (!isObject(target) || !isObjectSource) {
    return isObjectSource ? bunshinClone(source, settings, refs) : source;
  }
  if (Object.isFrozen(target)) {
    throw new TypeError("Target object frozen");
  }
  if (refs.has(source)) {
    return refs.get(source);
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    return mergeArray(target, source, settings, refs);
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    if (!settings.preserveDescriptors) {
      return isObjectPrototype(target) && isObjectPrototype(source) ? mergePlainObjectFast(target, source, settings, refs) : mergePlainObject(target, source, settings, refs);
    }
    return mergeWithDescriptors(target, source, settings, refs);
  }
  if (target instanceof Map && source instanceof Map) {
    return mergeMap(target, source, settings, refs);
  }
  if (target instanceof Set && source instanceof Set) {
    return mergeSet(target, source, settings, refs);
  }
  return bunshinClone(source, settings, refs);
}
var BUILTIN_ARRAY_MERGE_FUNCTIONS = {
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
  },
  replace: (_, source) => source.slice()
};
function createArrayContext(settings, refs) {
  return {
    clone: (value) => bunshinClone(value, settings, refs),
    merge: (target, source) => merge(target, source, settings, refs),
    refs,
    settings
  };
}
function mergeArray(target, source, settings, refs) {
  const { arrays, nullish } = settings;
  if (arrays === "merge" && nullish !== "loose" && isShallowArray(target) && isShallowArray(source)) {
    return source.slice();
  }
  return (typeof arrays === "string" ? BUILTIN_ARRAY_MERGE_FUNCTIONS[arrays] : arrays)(target, source, createArrayContext(settings, refs));
}
function mergeMap(target, source, settings, refs) {
  refs.set(source, target);
  let result = null;
  for (const [key, sourceValue] of source) {
    if (!target.has(key)) {
      if (result === null) {
        result = new Map(target);
        refs.set(source, result);
      }
      result.set(key, bunshinClone(sourceValue, settings, refs));
      continue;
    }
    const targetValue = target.get(key);
    const mergedValue = merge(targetValue, sourceValue, settings, refs);
    if (isSame(mergedValue, targetValue)) {
      continue;
    }
    if (result === null) {
      result = new Map(target);
      refs.set(source, result);
    }
    result.set(key, mergedValue);
  }
  return result ?? target;
}
function mergePlainObject(target, source, settings, refs) {
  const result = {};
  const state = refs.setPlaceholder(source, result);
  let isMaterialized = false;
  function materialize() {
    if (isMaterialized) {
      return;
    }
    isMaterialized = true;
    forEachOwnKey(target, (key) => Reflect.set(result, key, target[key]));
  }
  forEachOwnKey(source, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }
    const sourceValue = source[key];
    if (!HAS_OWN.call(target, key)) {
      materialize();
      Reflect.set(result, key, bunshinClone(sourceValue, settings, refs));
      return;
    }
    const targetValue = target[key];
    const mergedValue = merge(targetValue, sourceValue, settings, refs);
    if (!isSame(mergedValue, targetValue)) {
      materialize();
      Reflect.set(result, key, mergedValue);
    }
  });
  if (!isMaterialized && !state.referenced) {
    refs.resolve(source, target);
    return target;
  }
  materialize();
  refs.resolve(source, result);
  return result;
}
function mergePlainObjectFast(target, source, settings, refs) {
  const result = {};
  const state = refs.setPlaceholder(source, result);
  let isMaterialized = false;
  function materialize() {
    if (isMaterialized) {
      return;
    }
    isMaterialized = true;
    for (const key in target) {
      HAS_OWN.call(target, key) && Reflect.set(result, key, target[key]);
    }
  }
  for (const key in source) {
    if (!HAS_OWN.call(source, key) || isUnsafeKey(key)) {
      continue;
    }
    const sourceValue = source[key];
    if (!HAS_OWN.call(target, key)) {
      materialize();
      Reflect.set(result, key, bunshinClone(sourceValue, settings, refs));
      continue;
    }
    const targetValue = target[key];
    if (isSame(targetValue, sourceValue)) {
      continue;
    }
    if (!isObject(sourceValue) || !isObject(targetValue)) {
      materialize();
      Reflect.set(result, key, sourceValue);
      continue;
    }
    const mergedValue = merge(targetValue, sourceValue, settings, refs);
    if (!isSame(mergedValue, targetValue)) {
      materialize();
      Reflect.set(result, key, mergedValue);
    }
  }
  if (!isMaterialized && !state.referenced) {
    refs.resolve(source, target);
    return target;
  }
  materialize();
  refs.resolve(source, result);
  return result;
}
function mergeSet(target, source, settings, refs) {
  const result = /* @__PURE__ */ new Set();
  refs.set(source, result);
  for (const item of target) {
    result.add(bunshinClone(item, settings, refs));
  }
  for (const item of source) {
    result.add(bunshinClone(item, settings, refs));
  }
  return result;
}
function mergeWithDescriptors(target, source, settings, refs) {
  const result = Object.create(
    Object.getPrototypeOf(target)
  );
  const state = refs.setPlaceholder(source, result);
  const targetDescs = Object.getOwnPropertyDescriptors(target);
  const sourceDescs = Object.getOwnPropertyDescriptors(source);
  const updates = /* @__PURE__ */ new Map();
  forEachOwnKey(sourceDescs, (key) => {
    if (isUnsafeKey(key)) {
      return;
    }
    const sourceDesc = sourceDescs[key];
    if (!sourceDesc) {
      return;
    }
    const targetDesc = targetDescs[key];
    if ("value" in sourceDesc) {
      const sourceValue = sourceDesc.value;
      const mergedValue = targetDesc && "value" in targetDesc ? merge(targetDesc.value, sourceValue, settings, refs) : bunshinClone(sourceValue, settings, refs);
      const mergedDesc = {
        ...sourceDesc,
        value: mergedValue
      };
      if (targetDesc && isSameDescriptor(targetDesc, mergedDesc)) {
        return;
      }
      updates.set(key, mergedDesc);
      return;
    }
    if (targetDesc && isSameDescriptor(targetDesc, sourceDesc)) {
      return;
    }
    updates.set(key, sourceDesc);
  });
  if (!updates.size && !state.referenced) {
    refs.resolve(source, target);
    return target;
  }
  forEachOwnKey(targetDescs, (key) => {
    const desc = updates.get(key) ?? targetDescs[key];
    desc && defineDescriptor(result, key, desc, settings);
    updates.delete(key);
  });
  for (const [key, desc] of updates) {
    defineDescriptor(result, key, desc, settings);
  }
  refs.resolve(source, result);
  return result;
}
function defineDescriptor(target, key, desc, settings) {
  try {
    Object.defineProperty(target, key, desc);
  } catch (error) {
    if (settings.strictDescriptors) {
      throw error;
    }
  }
}
function isSameDescriptor(a, b) {
  if (a.configurable !== b.configurable || a.enumerable !== b.enumerable) {
    return false;
  }
  if ("value" in a || "value" in b) {
    return "value" in a && "value" in b && a.writable === b.writable && isSame(a.value, b.value);
  }
  return a.get === b.get && a.set === b.set;
}
function isGattaiMergeOptions(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (!keys.length) {
    return true;
  }
  return keys.every(
    (key) => key === "arrays" || key === "nullish" || key === "preserveDescriptors" || key === "strictDescriptors"
  );
}
function isObjectPrototype(value) {
  return Object.getPrototypeOf(value) === Object.prototype;
}
function isSame(a, b) {
  return a === b || a !== a && b !== b;
}
function isShallowArray(array) {
  for (let i = 0, l = array.length; i < l; i++) {
    if (isObject(array[i])) {
      return false;
    }
  }
  return true;
}
function resolveOptions2(options) {
  let {
    arrays = "replace",
    nullish = "loose",
    preserveDescriptors = false,
    strictDescriptors = false
  } = options;
  let hasError = false;
  if (typeof arrays === "string") {
    arrays = arrays.toLowerCase();
    if (!ARRAYS.includes(arrays)) {
      hasError = true;
    }
  } else if (typeof arrays !== "function") {
    hasError = true;
  }
  if (hasError) {
    console.warn("Invalid arrays option. Fallback: 'replace'.");
    arrays = "replace";
  }
  nullish = nullish.toLowerCase();
  if (!NULLISH.includes(nullish)) {
    console.warn("Invalid nullish option. Fallback: 'loose'.");
    nullish = "loose";
  }
  if (typeof preserveDescriptors !== "boolean") {
    console.warn("Invalid preserveDescriptors option. Fallback: false.");
    preserveDescriptors = false;
  }
  if (typeof strictDescriptors !== "boolean") {
    console.warn("Invalid strictDescriptors option. Fallback: false.");
    strictDescriptors = false;
  }
  return { arrays, nullish, preserveDescriptors, strictDescriptors };
}

export { gattaiMerge };
