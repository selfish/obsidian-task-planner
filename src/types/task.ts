import { FileAdapter } from "./file-adapter";

export enum TaskStatus {
  AttentionRequired = 0,
  Todo = 1,
  InProgress = 2,
  Delegated = 3,
  Complete = 4,
  Canceled = 5,
}

export interface TaskItem<TFile> {
  status: TaskStatus;
  text: string;
  file: FileAdapter<TFile>;
  folderType?: string;
  attributes?: Record<string, string | boolean>;
  tags?: string[];
  line?: number;
  subtasks?: TaskItem<TFile>[];
}

export function getTaskId<T>(task: TaskItem<T>): string {
  return task.file.id + "-" + (task.line || 0) + "-" + task.text;
}
