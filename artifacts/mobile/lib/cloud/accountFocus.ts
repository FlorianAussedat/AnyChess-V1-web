/** One-shot focus of the existing account section, without adding a route/history entry. */
let requested = false;
const listeners = new Set<() => void>();
export function requestAccountFocus(): void {
  requested = true;
  for (const listener of listeners) listener();
}
export function consumeAccountFocus(): boolean {
  const pending = requested;
  requested = false;
  return pending;
}
export function subscribeAccountFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
