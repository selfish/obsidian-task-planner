import { App, TFile } from "obsidian";

export function cleanFileName(fileName: string): string {
  const name = fileName.replace(/\.md$/, "");
  const cleaned = name.replace(/^[\d- ]+/, "").trim();
  return cleaned || name;
}

export function getFileDisplayName(file: TFile, app: App): string {
  const cache = app.metadataCache.getFileCache(file);
  const frontmatterTitle = cache?.frontmatter?.title;

  if (frontmatterTitle && typeof frontmatterTitle === "string") {
    return frontmatterTitle;
  }

  return cleanFileName(file.name);
}

/**
 * Set a frontmatter property on a file using Obsidian's processFrontMatter API.
 * This properly handles creating frontmatter if none exists and preserving existing properties.
 */
export async function setFrontmatterProperty(app: App, file: TFile, key: string, value: unknown): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    frontmatter[key] = value;
  });
}

/**
 * Remove a frontmatter property from a file.
 */
export async function removeFrontmatterProperty(app: App, file: TFile, key: string): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    delete frontmatter[key];
  });
}
