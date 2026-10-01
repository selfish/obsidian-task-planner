import * as React from "react";

import { moment } from "../utils/moment";

/** Invalidate calendar-derived views without scanning or writing the vault. */
export function useCurrentDay(containerRef: React.RefObject<HTMLElement | null>): string {
  const [currentDay, setCurrentDay] = React.useState(() => moment().format("YYYY-MM-DD"));

  React.useEffect(() => {
    const ownerDocument = containerRef.current?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!ownerDocument || !ownerWindow) return undefined;

    let midnightTimer: number | undefined;

    const scheduleMidnightRefresh = () => {
      if (midnightTimer !== undefined) ownerWindow.clearTimeout(midnightTimer);
      const now = moment();
      const nextMidnight = now.clone().add(1, "day").startOf("day");
      midnightTimer = ownerWindow.setTimeout(refreshCurrentDay, Math.max(0, nextMidnight.diff(now)) + 1);
    };

    const refreshCurrentDay = () => {
      setCurrentDay(moment().format("YYYY-MM-DD"));
      scheduleMidnightRefresh();
    };

    const refreshAfterVisibilityChange = () => {
      if (ownerDocument.visibilityState === "visible") refreshCurrentDay();
    };

    scheduleMidnightRefresh();
    ownerWindow.addEventListener("focus", refreshCurrentDay);
    ownerDocument.addEventListener("visibilitychange", refreshAfterVisibilityChange);

    return () => {
      if (midnightTimer !== undefined) ownerWindow.clearTimeout(midnightTimer);
      ownerWindow.removeEventListener("focus", refreshCurrentDay);
      ownerDocument.removeEventListener("visibilitychange", refreshAfterVisibilityChange);
    };
  }, [containerRef]);

  return currentDay;
}
