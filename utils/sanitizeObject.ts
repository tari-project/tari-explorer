export function sanitizeBigInts(obj: any, seen = new WeakSet()): any {
  if (typeof obj === "bigint") {
    return obj.toString();
  }

  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Avoid circular references
  if (seen.has(obj)) {
    return obj;
  }
  seen.add(obj);

  // Don't sanitize buffers or typed arrays
  if (
    obj instanceof Buffer ||
    ArrayBuffer.isView(obj) || // covers Uint8Array, etc.
    obj instanceof ArrayBuffer
  ) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeBigInts(item, seen));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeBigInts(value, seen);
  }
  return result;
}
