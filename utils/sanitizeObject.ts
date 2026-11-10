export function sanitizeBigInts(
  obj: any,
  seen: WeakMap<object, any> = new WeakMap(),
): any {
  if (typeof obj === "bigint") {
    return obj.toString();
  }

  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Don't sanitize buffers, typed arrays, dates, or regexes
  if (
    obj instanceof Buffer ||
    ArrayBuffer.isView(obj) || // covers Uint8Array, etc.
    obj instanceof ArrayBuffer ||
    obj instanceof Date ||
    obj instanceof RegExp
  ) {
    return obj;
  }

  // Return the already-sanitized clone for shared DAG references and cycles
  if (seen.has(obj)) {
    return seen.get(obj);
  }

  if (Array.isArray(obj)) {
    const arrResult: any[] = [];
    seen.set(obj, arrResult);
    for (const item of obj) {
      arrResult.push(sanitizeBigInts(item, seen));
    }
    return arrResult;
  }

  const result: any = {};
  seen.set(obj, result);
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeBigInts(value, seen);
  }
  return result;
}
