import { FileAdapter } from "./file-adapter";
import { TodoItem } from "./todo";

export interface TodosInFiles<TFile> {
  file: FileAdapter<TFile>,
  todos: TodoItem<TFile>[]
}
