type Change = { userId: string; blocked: boolean };
const listeners = new Set<(change: Change) => void>();
export function notifyModerationChange(change: Change) {
  for (const listener of listeners) listener(change);
}
export function listenModerationChange(listener: (change: Change) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
