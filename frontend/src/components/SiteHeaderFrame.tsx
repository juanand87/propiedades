import type { ReactNode } from "react";

/** A zero-height frame preserves the floating cover while keeping it in the scroll flow. */
export function SiteHeaderFrame({
  sticky,
  children,
}: {
  sticky?: boolean;
  children: ReactNode;
}) {
  return sticky ? (
    <div className="sticky-header-wrap">{children}</div>
  ) : (
    <>{children}</>
  );
}
