import { Completion } from "./completion";
import { TaskPlannerSettings } from "../../settings";
import { AttributesStructure, TaskItem, TaskParsingResult, TaskStatus } from "../../types";
import { LineParser } from "../parsers/line-parser";

export class StatusOperations {
  private lineParser: LineParser;

  constructor(private settings?: TaskPlannerSettings) {
    this.lineParser = new LineParser(settings);
  }

  convertAttributes(line: string): string {
    const parsedLine = this.lineParser.parseLine(line);
    const parsedAttributes = this.lineParser.parseAttributes(parsedLine.line);
    const original: Record<string, string | boolean> = {};
    for (const [key, value] of Object.entries(parsedAttributes.attributes)) original[key.toLowerCase()] = value;
    const converted = this.convertAttributeEntries(parsedAttributes, this.lineParser.parseAttributeEntries(parsedLine.line));

    for (const key of Object.keys(original)) {
      if (!Object.keys(converted.attributes).some((convertedKey) => convertedKey.toLowerCase() === key)) parsedLine.line = this.lineParser.updateAttribute(parsedLine.line, key, undefined);
    }
    for (const [key, value] of Object.entries(converted.attributes)) {
      parsedLine.line = this.lineParser.updateAttribute(parsedLine.line, key, value, original[key.toLowerCase()] === value, true);
    }
    return this.lineParser.lineToString(parsedLine);
  }

  private convertAttributeEntries(attributes: AttributesStructure, entries: [string, string | boolean][]): AttributesStructure {
    const converted: Record<string, string | boolean> = {};
    for (const [sourceKey, sourceValue] of entries) {
      let key = sourceKey;
      let value = sourceValue;
      if (typeof value === "string") {
        value = Completion.completeDate(value) ?? value;
      } else if (value === true) {
        const completion = Completion.completeDate(key.toLowerCase());
        if (completion !== null) {
          key = this.settings?.dueDateAttribute || "due";
          value = completion;
        }
      }

      const keyLower = key.toLowerCase();
      if (["critical", "high", "medium", "low", "lowest"].includes(keyLower)) {
        key = "priority";
        value = keyLower;
      }
      for (const existingKey of Object.keys(converted)) {
        if (existingKey.toLowerCase() === key.toLowerCase()) delete converted[existingKey];
      }
      converted[key] = value;
    }
    return { ...attributes, attributes: converted };
  }

  toggleTask(line: string): string {
    const parsedLine = this.lineParser.parseLine(line);
    if (parsedLine.checkbox) {
      parsedLine.checkbox = "";
    } else {
      parsedLine.checkbox = "[ ]";
    }
    return this.lineParser.lineToString(parsedLine);
  }

  setCheckmark(line: string, checkMark: string): string {
    const parsedLine = this.lineParser.parseLine(line);
    parsedLine.checkbox = `[${checkMark}]`;
    return this.lineParser.lineToString(parsedLine);
  }

  markToStatus(mark: string): TaskStatus {
    switch (mark.toLowerCase()) {
      case "]":
      case "-":
      case "c":
        return TaskStatus.Canceled;
      case ">":
        return TaskStatus.InProgress;
      case "!":
        return TaskStatus.AttentionRequired;
      case "x":
        return TaskStatus.Complete;
      case "d":
        return TaskStatus.Delegated;
      case " ":
      default:
        return TaskStatus.Todo;
    }
  }

  private getIndentationLevel(str: string) {
    return (str.match(/ /g)?.length || 0) + (str.match(/\t/g)?.length || 0) * 4;
  }

  toTask<T>(line: string, lineNumber: number): TaskParsingResult<T> {
    const parsedLine = this.lineParser.parseLine(line);
    const indentLevel = this.getIndentationLevel(parsedLine.indentation);
    if (!parsedLine.checkbox)
      return {
        lineNumber,
        isTask: false,
        indentLevel,
      };
    const attributesMatching = this.lineParser.parseAttributes(parsedLine.line);
    const task = {
      status: this.markToStatus(parsedLine.checkbox[1]),
      text: attributesMatching.textWithoutAttributes,
      attributes: attributesMatching.attributes,
      tags: attributesMatching.tags,
      file: undefined,
    } as TaskItem<T>;
    const res: TaskParsingResult<T> = {
      lineNumber,
      isTask: true,
      task,
      indentLevel: this.getIndentationLevel(parsedLine.indentation),
    };
    if (lineNumber !== undefined) {
      task.line = lineNumber;
    }
    return res;
  }
}
