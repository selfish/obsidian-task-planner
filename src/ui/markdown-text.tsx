import { App, Component, MarkdownRenderer } from "obsidian";

import * as React from "react";

interface MarkdownTextProps {
  text: string;
  app: App;
  sourcePath: string;
  className?: string;
}

/**
 * Renders markdown text using Obsidian's native MarkdownRenderer.
 * This provides proper rendering of links, wikilinks, and inline formatting.
 */
export function MarkdownText({ text, app, sourcePath, className }: MarkdownTextProps): React.ReactElement {
  const containerRef = React.useRef<HTMLSpanElement>(null);
  const componentRef = React.useRef<Component | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // Create a Component for lifecycle management
    componentRef.current = new Component();
    componentRef.current.load();

    // Clear previous content
    container.empty();

    // Render markdown
    void MarkdownRenderer.render(app, text, container, sourcePath, componentRef.current);

    // Cleanup on unmount or re-render
    return () => {
      componentRef.current?.unload();
      componentRef.current = null;
    };
  }, [text, app, sourcePath]);

  return <span ref={containerRef} className={className} />;
}
