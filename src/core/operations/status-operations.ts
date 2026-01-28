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
    let parsedAttributes = this.lineParser.parseAttributes(parsedLine.line);
    parsedAttributes = this.convertDateAttributes(parsedAttributes);
    parsedAttributes = this.convertPriorityAttributes(parsedAttributes);
    parsedLine.line = this.lineParser.attributesToString(parsedAttributes);
    return this.lineParser.lineToString(parsedLine);
  }

  private convertDateAttributes(attributes: AttributesStructure): AttributesStructure {
    Object.keys(attributes.attributes).forEach((key) => {
      const val = attributes.attributes[key];
      if (typeof val === "string") {
        const completion = Completion.completeDate(val);
        if (completion !== null) {
          attributes.attributes[key] = completion;
        }
      } else if (val === true) {
        const completion = Completion.completeDate(key);
        if (completion !== null) {
          delete attributes.attributes[key];
          attributes.attributes[this.settings?.dueDateAttribute || "due"] = completion;
        }
      }
    });
    return attributes;
  }

  private convertPriorityAttributes(attributes: AttributesStructure): AttributesStructure {
    Object.keys(attributes.attributes).forEach((key) => {
      const keyLower = key.toLowerCase();
      if (["critical", "high", "medium", "low", "lowest"].includes(keyLower)) {
        delete attributes.attributes[key];
        attributes.attributes["priority"] = keyLower;
      }
    });
    return attributes;
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

  private markToStatus(mark: string): TaskStatus {
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
      file: undefined as unknown,
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
