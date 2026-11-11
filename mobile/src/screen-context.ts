import { createContext, ReactNode, useContext } from "react";
type Screen =
  | "feed"
  | "catalog"
  | "messages"
  | "manage"
  | "account"
  | "recorder"
  | "videoProfile";
// State stays in the persistent layout; route components mount only their own UI.
export const ScreenContext = createContext<
  (Record<Screen, ReactNode> & { active: Screen }) | null
>(null);
export function useScreen(screen?: Screen) {
  const context = useContext(ScreenContext);
  if (!context) throw new Error("Falta el layout de Propiedades.");
  return context[screen || context.active];
}
