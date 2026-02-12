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

export async function setFrontmatterProperty(app: App, file: TFile, key: string, value: unknown): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    frontmatter[key] = value;
  });
}

export async function removeFrontmatterProperty(app: App, file: TFile, key: string): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    delete frontmatter[key];
  });
}
