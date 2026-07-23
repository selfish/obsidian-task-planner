export interface FileAdapter<T> {
  file: T;
  name: string;
  path: string;
  id: string;
  getContent(): Promise<string>;
  setContent(val: string): Promise<void>;
  processContent?(update: (content: string) => string): Promise<void>;
  isInFolder(folder: string): boolean;
  shouldIgnore?(): boolean;
}
