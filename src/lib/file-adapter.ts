import { App, TFile } from "obsidian";

import { FileAdapter } from "../types";

export class ObsidianFile implements FileAdapter<TFile> {
  name: string;

  constructor(
    private app: App,
    public file: TFile
  ) {
    this.name = file.basename;
  }

  get id(): string {
    return this.file.path;
  }

  get path(): string {
    return this.file.path;
  }

  isInFolder(folder: string): boolean {
    const path = this.file.path.toLowerCase();
    // Trim only boundary slashes; keep interior separators and matching semantics.
    // Explicit scans avoid retrying a trailing-slash regex at every interior slash.
    const lowerFolder = folder.toLowerCase();
    let start = 0;
    let end = lowerFolder.length;
    while (start < end && lowerFolder.charCodeAt(start) === 47) start++;
    while (end > start && lowerFolder.charCodeAt(end - 1) === 47) end--;
    const normalizedFolder = lowerFolder.slice(start, end);
    return normalizedFolder !== "" && (path === normalizedFolder || path.startsWith(`${normalizedFolder}/`));
  }

  shouldIgnore(): boolean {
    const cache = this.app.metadataCache.getFileCache(this.file);
    return cache?.frontmatter?.["task-planner-ignore"] === true;
  }

  async getContent(): Promise<string> {
    return await this.app.vault.cachedRead(this.file);
  }

  async setContent(content: string): Promise<void> {
    await this.app.vault.modify(this.file, content);
  }

  async processContent(update: (content: string) => string): Promise<void> {
    await this.app.vault.process(this.file, update);
  }
}
