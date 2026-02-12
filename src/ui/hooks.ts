import { App, TFile, setIcon } from "obsidian";

import * as React from "react";

import { getFileDisplayName } from "../utils/file-utils";

export function useFileDisplayName(file: TFile, app: App): string {
  const [displayName, setDisplayName] = React.useState(() => getFileDisplayName(file, app));

  React.useEffect(() => {
    setDisplayName(getFileDisplayName(file, app));

    const onCacheChanged = (changedFile: TFile) => {
      if (changedFile.path === file.path) {
        setDisplayName(getFileDisplayName(file, app));
      }
    };

    const ref = app.metadataCache.on("changed", onCacheChanged as () => void);
    return () => {
      app.metadataCache.offref(ref);
    };
  }, [file, app]);

  return displayName;
}

export function useIconRef(iconName: string): (node: HTMLElement | null) => void {
  return React.useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        node.replaceChildren();
        setIcon(node, iconName);
      }
    },
    [iconName]
  );
}
