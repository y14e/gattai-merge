/**
 * API
 */
export function gattaiMerge(target, sources, options = {}) {
    if (!isObject(target)) {
        return target;
    }
    if (Object.isFrozen(target)) {
        throw new TypeError('Target object frozen.');
    }
    const __ref__ = new WeakMap();
    __ref__.set(target, target);
    let result = target;
    for (let i = 0, l = sources.length; i < l; i++) {
        result = dispatch(result, sources[i], options, __ref__);
    }
    return result;
}
/**
 * Core (Dispatch)
 */
function dispatch(target, source, options, __ref__) {
    if (Object.is(target, source)) {
        return target;
    }
    if (target == null) {
        return clone(source, options, __ref__);
    }
    if (source == null) {
        return source;
    }
    const targetIsObject = isObject(target);
    const sourceIsObject = isObject(source);
    if (!targetIsObject || !sourceIsObject) {
        return sourceIsObject ? clone(source, options, __ref__) : source;
    }
    if (__ref__.has(source)) {
        return __ref__.get(source);
    }
    if (Array.isArray(target) && Array.isArray(source)) {
        return mergeArray(target, source, options, __ref__);
    }
    if (target instanceof Map && source instanceof Map) {
        return mergeMap(target, source, options, __ref__);
    }
    if (target instanceof Set && source instanceof Set) {
        const result = new Set();
        __ref__.set(source, result);
        for (const v of target) {
            result.add(clone(v, options, __ref__));
        }
        for (const v of source) {
            result.add(clone(v, options, __ref__));
        }
        return result;
    }
    if (isPlainObject(target) && isPlainObject(source)) {
        return options.descriptors
            ? mergeObjectWithDescriptor(target, source, options, __ref__)
            : merge(target, source, options, __ref__);
    }
    return clone(source, options, __ref__);
}
/**
 * Core (Merge)
 */
const HAS_OWN = Object.prototype.hasOwnProperty;
function merge(target, source, options, __ref__) {
    __ref__.set(source, target);
    let result = null;
    for (const key in source) {
        if (!HAS_OWN.call(source, key) || isUnsafeKey(key))
            continue;
        const sv = source[key];
        const tv = target[key];
        if (tv === undefined) {
            if (result === null) {
                result = Object.create(Object.getPrototypeOf(target));
                Object.assign(result, target);
                __ref__.set(source, result);
            }
            result[key] = clone(sv, options, __ref__);
            continue;
        }
        const merged = dispatch(tv, sv, options, __ref__);
        if (!Object.is(merged, tv)) {
            if (result === null) {
                result = Object.create(Object.getPrototypeOf(target));
                Object.assign(result, target);
                __ref__.set(source, result);
            }
            result[key] = merged;
        }
    }
    return result ?? target;
}
function mergeArray(target, source, options, __ref__) {
    const mode = options.arrays ?? 'replace';
    if (mode === 'replace') {
        return clone(source, options, __ref__);
    }
    __ref__.set(source, target);
    if (mode === 'concat') {
        const result = new Array(target.length + source.length);
        for (let i = 0; i < target.length; i++) {
            result[i] = target[i];
        }
        for (let i = 0; i < source.length; i++) {
            result[target.length + i] = clone(source[i], options, __ref__);
        }
        __ref__.set(source, result);
        return result;
    }
    let result = null;
    const max = Math.max(target.length, source.length);
    for (let i = 0; i < max; i++) {
        const tv = i < target.length ? target[i] : undefined;
        const sv = i < source.length ? source[i] : undefined;
        const hasSource = i < source.length;
        const hasTarget = i < target.length;
        if (!hasSource && hasTarget) {
            if (result === null) {
                result = [...target];
                __ref__.set(source, result);
            }
            result[i] = tv;
            continue;
        }
        const merged = !hasTarget ? clone(sv, options, __ref__) : dispatch(tv, sv, options, __ref__);
        if (!Object.is(merged, tv)) {
            if (result === null) {
                result = [...target];
                __ref__.set(source, result);
            }
            if (result.length <= i) {
                result.length = i + 1;
            }
            result[i] = merged;
        }
        else if (result !== null) {
            if (result.length <= i) {
                result.length = i + 1;
            }
            result[i] = tv;
        }
    }
    return result ?? target;
}
function mergeMap(target, source, options, __ref__) {
    __ref__.set(source, target);
    let result = null;
    for (const [k, v] of source) {
        if (!target.has(k)) {
            if (result === null) {
                result = new Map(target);
                __ref__.set(source, result);
            }
            result.set(k, clone(v, options, __ref__));
            continue;
        }
        const tv = target.get(k);
        const merged = dispatch(tv, v, options, __ref__);
        if (!Object.is(merged, tv)) {
            if (result === null) {
                result = new Map(target);
                __ref__.set(source, result);
            }
            result.set(k, merged);
        }
    }
    return result ?? target;
}
function mergeObjectWithDescriptor(target, source, options, __ref__) {
    const placeholder = Object.create(Object.getPrototypeOf(target));
    __ref__.set(source, placeholder);
    let result = null;
    const tDesc = Object.getOwnPropertyDescriptors(target);
    const sDesc = Object.getOwnPropertyDescriptors(source);
    for (const key of Reflect.ownKeys(sDesc)) {
        if (isUnsafeKey(key)) {
            continue;
        }
        const sd = sDesc[key];
        const td = tDesc[key];
        if ('value' in sd) {
            const tv = td && 'value' in td ? td.value : undefined;
            const merged = td === undefined || !('value' in td)
                ? clone(sd.value, options, __ref__)
                : dispatch(tv, sd.value, options, __ref__);
            if (!td || !('value' in td) || !Object.is(merged, td.value)) {
                result ??= cloneObjectWithDescriptors(target, options, __ref__);
                Object.defineProperty(result, key, { ...sd, value: merged });
            }
        }
        else if (!td) {
            result ??= cloneObjectWithDescriptors(target, options, __ref__);
            Object.defineProperty(result, key, sd);
        }
    }
    if (result === null) {
        __ref__.set(source, target);
        return target;
    }
    Object.defineProperties(placeholder, Object.getOwnPropertyDescriptors(result));
    return placeholder;
}
/**
 * Core (Clone)
 */
function clone(value, options, __ref__) {
    // 1. Primitive
    if (!isObject(value)) {
        return value;
    }
    // Circular ref
    if (__ref__.has(value)) {
        return __ref__.get(value);
    }
    // 2. Plain object
    if (isPlainObject(value)) {
        const result = Object.create(Object.getPrototypeOf(value));
        __ref__.set(value, result);
        for (const key in value) {
            if (!HAS_OWN.call(value, key) || isUnsafeKey(key)) {
                continue;
            }
            result[key] = clone(value[key], options, __ref__);
        }
        return result;
    }
    // 3. Array
    if (Array.isArray(value)) {
        const result = [];
        __ref__.set(value, result);
        for (let i = 0, l = value.length; i < l; i++) {
            result[i] = clone(value[i], options, __ref__);
        }
        return result;
    }
    // 4. Date
    if (value instanceof Date) {
        const result = new Date(value.getTime());
        __ref__.set(value, result);
        return result;
    }
    // 5. RegExp
    if (value instanceof RegExp) {
        const result = new RegExp(value.source, value.flags);
        __ref__.set(value, result);
        return result;
    }
    // 6. ArrayBuffer and TypedArray
    if (ArrayBuffer.isView(value)) {
        const Ctor = value.constructor;
        const result = new Ctor(value);
        __ref__.set(value, result);
        return result;
    }
    if (value instanceof ArrayBuffer) {
        const result = value.slice(0);
        __ref__.set(value, result);
        return result;
    }
    // 7. Error and DOMException
    if (value instanceof Error || value instanceof DOMException) {
        const Ctor = value.constructor;
        const result = new Ctor(value.message);
        __ref__.set(value, result);
        result.name = value.name;
        result.stack = value.stack;
        if ('cause' in value) {
            result.cause = clone(value.cause, options, __ref__);
        }
        for (const [k, v] of Object.entries(value)) {
            Object.defineProperty(result, k, {
                configurable: true,
                enumerable: true,
                value: clone(v, options, __ref__),
                writable: true,
            });
        }
        return result;
    }
    // 8. Blob
    if (value instanceof Blob) {
        const result = value.slice(0, value.size, value.type);
        __ref__.set(value, result);
        return result;
    }
    // 9. ImageData
    if (typeof ImageData !== 'undefined' && value instanceof ImageData) {
        const result = new ImageData(new Uint8ClampedArray(value.data), value.width, value.height);
        __ref__.set(value, result);
        return result;
    }
    // 10. Map
    if (value instanceof Map) {
        const result = new Map();
        __ref__.set(value, result);
        for (const [k, v] of value) {
            result.set(k, clone(v, options, __ref__));
        }
        return result;
    }
    // 11. Set
    if (value instanceof Set) {
        const result = new Set();
        __ref__.set(value, result);
        for (const v of value) {
            result.add(clone(v, options, __ref__));
        }
        return result;
    }
    // 12. Object with descriptors
    if (options.descriptors) {
        return cloneObjectWithDescriptors(value, options, __ref__);
    }
    // Fallback
    __ref__.set(value, value);
    return value;
}
function cloneObjectWithDescriptors(obj, options, __ref__) {
    const result = Object.create(Object.getPrototypeOf(obj));
    __ref__.set(obj, result);
    const descriptors = Object.getOwnPropertyDescriptors(obj);
    for (const key of Reflect.ownKeys(descriptors)) {
        if (isUnsafeKey(key)) {
            continue;
        }
        const descriptor = descriptors[key];
        if ('value' in descriptor) {
            descriptor.value = clone(descriptor.value, options, __ref__);
        }
        Object.defineProperty(result, key, descriptor);
    }
    return result;
}
// Utils
const OBJECT_TO_STRING = Object.prototype.toString;
function isObject(value) {
    return typeof value === 'object' && value !== null;
}
function isPlainObject(value) {
    return OBJECT_TO_STRING.call(value) === '[object Object]';
}
function isUnsafeKey(key) {
    return key === '__proto__' || key === 'prototype' || key === 'constructor';
}
