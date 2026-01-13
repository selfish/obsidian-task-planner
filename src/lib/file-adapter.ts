import { FileAdapter } from "../types/file-adapter";
import { App, TFile } from "obsidian";

export class ObsidianFile implements FileAdapter<TFile> {
  name: string;

  constructor(private app: App, public file: TFile) {
    this.name = file.basename;
  }

  get id(): string {
    return this.file.path;
  }

  get path(): string {
    return this.file.path;
  }

  async getLastModifiedAsync(): Promise<Date> {
    const stat = await this.app.vault.adapter.stat(this.file.path);
    return new Date(stat?.mtime ?? 0);
  }

  isInFolder(folder: string): boolean {
    return this.file.path.toLowerCase().startsWith(folder.toLowerCase());
  }

  async getContentAsync(): Promise<string> {
    return await this.app.vault.cachedRead(this.file);
  }

  async setContentAsync(content: string): Promise<void> {
    await this.app.vault.modify(this.file, content);
  }

  async renameAsync(newPath: string): Promise<void> {
    await this.createHierarchy(newPath);
    await this.app.vault.rename(this.file, newPath);
  }

  private async createHierarchy(path: string, isParent = false): Promise<void> {
    const parent = this.getParent(path);
    if (!(await this.app.vault.adapter.exists(parent, false))) {
      await this.createHierarchy(parent, true);
    }
    if (isParent) {
      await this.app.vault.createFolder(path);
    }
  }

  private getParent(path: string): string {
    const lastSlash = path.lastIndexOf("/");
    return path.substring(0, lastSlash);
  }
}
