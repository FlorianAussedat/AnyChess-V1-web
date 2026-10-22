/** Per-key serialization shared by ordinary writes and cloud read/merge/write. */
const queues = new WeakMap<object, Map<string, Promise<unknown>>>();
export function serializedUpdate<T>(storage: object, key: string, action: () => Promise<T>): Promise<T> {
  let keys = queues.get(storage);
  if (!keys) queues.set(storage, keys = new Map());
  const previous = keys.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  keys.set(key, next);
  void next.finally(() => { if (keys.get(key) === next) keys.delete(key); }).catch(() => {});
  return next;
}
