import { FileAdapter } from "./file-adapter";
import { TaskItem } from "./task";

export interface TasksInFiles<TFile> {
  file: FileAdapter<TFile>;
  tasks: TaskItem<TFile>[];
}
