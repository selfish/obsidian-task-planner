import { App, TFile } from "obsidian";

import { FileAdapter } from "../types";
import { FileOperationError } from "./errors";

export class ObsidianFile implements FileAdapter<TFile> {
  private static pendingWrites = new WeakMap<TFile, Promise<void>>();

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
    return await this.app.vault.read(this.file);
  }

  async setContent(content: string): Promise<void> {
    await this.app.vault.modify(this.file, content);
  }

  async processContent(update: (content: string) => string): Promise<void> {
    const vault = this.app.vault as typeof this.app.vault & {
      process?: (file: TFile, update: (content: string) => string) => Promise<string>;
    };
    if (vault.process) {
      await vault.process(this.file, update);
      return;
    }

    // ponytail: Obsidian 1.0 has no compare-and-swap; double-read detects conflicts but cannot close the final read/modify race. Vault.process handles newer hosts.
    const key = this.file;
    const path = this.file.path;
    const previous = ObsidianFile.pendingWrites.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        let content: string;
        try {
          content = await vault.read(this.file);
        } catch (error) {
          if (error instanceof FileOperationError) throw error;
          throw new FileOperationError(`Failed to read file: ${path}`, path, "read", "HIGH", { originalError: error instanceof Error ? error.message : String(error) });
        }
        let updated: string;
        try {
          updated = update(content);
        } catch (error) {
          if (error instanceof FileOperationError) throw error;
          throw new FileOperationError(`Failed to write file: ${path}`, path, "write", "HIGH", { originalError: error instanceof Error ? error.message : String(error) });
        }
        let latest: string;
        try {
          latest = await vault.read(this.file);
        } catch (error) {
          if (error instanceof FileOperationError) throw error;
          throw new FileOperationError(`Failed to read file: ${path}`, path, "read", "HIGH", { originalError: error instanceof Error ? error.message : String(error) });
        }
        if (latest !== content) throw new FileOperationError(`File changed during update: ${path}`, path, "write", "HIGH");
        try {
          await vault.modify(this.file, updated);
        } catch (error) {
          if (error instanceof FileOperationError) throw error;
          throw new FileOperationError(`Failed to write file: ${path}`, path, "write", "HIGH", { originalError: error instanceof Error ? error.message : String(error) });
        }
      });
    ObsidianFile.pendingWrites.set(key, current);
    try {
      await current;
    } finally {
      if (ObsidianFile.pendingWrites.get(key) === current) {
        ObsidianFile.pendingWrites.delete(key);
      }
    }
  }
}
