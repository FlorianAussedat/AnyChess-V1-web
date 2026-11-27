/** Node test shim — real Expo is not loaded during speech unit tests. */
export function requireOptionalNativeModule<T>(_name: string): T | null {
  return null;
}
