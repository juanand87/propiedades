// Viewer-scoped state shared by feed, profiles and search.
const states = new Map<string, boolean>();
const listeners = new Set<() => void>();
const key = (viewer: string, creator: string) => viewer + ":" + creator;
export function followState(viewer?: string, creator?: string) {
  return viewer && creator ? states.get(key(viewer, creator)) : undefined;
}
export function rememberFollowState(
  viewer: string | undefined,
  creator: string,
  followed: boolean,
) {
  if (!viewer || typeof followed !== "boolean") return;
  const id = key(viewer, creator);
  if (states.get(id) === followed) return;
  states.set(id, followed);
  if (states.size > 1000) states.delete(states.keys().next().value!);
  for (const listener of listeners) listener();
}
export function subscribeFollowState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
