import { TaskItem } from "./task";

export interface LineStructure {
  indentation: string;
  listMarker: string;
  listMarkerSuffix?: string;
  checkbox: string;
  checkboxSuffix?: string;
  date: string;
  dateSuffix?: string;
  line: string;
}

export interface TaskParsingResult<T> {
  isTask: boolean;
  lineNumber: number;
  task?: TaskItem<T>;
  indentLevel: number;
}

export interface AttributesStructure {
  textWithoutAttributes: string;
  attributes: Record<string, string | boolean>;
  tags: string[];
}
