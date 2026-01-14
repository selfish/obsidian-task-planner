import { StandardDependencies } from "./StandardDependencies";
import { TodoItem } from "../types/todo";
import { TFile } from "obsidian";

export interface TodayComponentProps {
  deps: StandardDependencies;
  todos: TodoItem<TFile>[];
}

// Placeholder component for future Today view implementation
export function TodayComponent(_props: TodayComponentProps): null {
  return null;
}
