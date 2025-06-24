/**
 * Type guard to check if a value is an AsyncIterable
 */
export function isAsyncIterable(value: any): value is AsyncIterable<any> {
  return value != null && typeof value[Symbol.asyncIterator] === "function";
}

/**
 * Collects all values from an AsyncIterable into an array
 */
export async function collectAsyncIterable<T>(
  asyncIterable: AsyncIterable<T>,
): Promise<T[]> {
  const results: T[] = [];
  for await (const item of asyncIterable) {
    results.push(item);
  }
  return results;
}

/**
 * Helper function that automatically handles both Promise and AsyncIterable return types.
 * If the result is an AsyncIterable, it collects all values into an array.
 * If the result is a Promise, it just awaits it.
 */
export async function handleGrpcResult<T>(
  result: Promise<T> | AsyncIterable<T>,
): Promise<T | T[]> {
  if (isAsyncIterable(result)) {
    return await collectAsyncIterable(result);
  } else {
    return await result;
  }
}
