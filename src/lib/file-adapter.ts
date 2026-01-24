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
    return this.file.path.toLowerCase().startsWith(folder.toLowerCase());
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
}
