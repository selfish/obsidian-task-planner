import { TodoItem } from "./todo";

export interface LineStructure {
  indentation: string;
  listMarker: string;
  checkbox: string;
  date: string;
  line: string;
}

export interface TodoParsingResult<T> {
  isTodo: boolean;
  lineNumber: number;
  todo?: TodoItem<T>;
  isBlank?: boolean;
  indentLevel: number;
}

export interface AttributesStructure {
  textWithoutAttributes: string;
  attributes: Record<string, string | boolean>;
  tags: string[];
}
