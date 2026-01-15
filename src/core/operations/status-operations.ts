import { TaskPlannerSettings } from "../../settings/types";
import { TodoItem, TodoStatus } from "../../types/todo";
import { TodoParsingResult, AttributesStructure } from "../../types/parsing";
import { LineParser } from "../parsers/line-parser";
import { Completion } from "./completion";

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
        // Complete date if it's an attribute value
        const completion = Completion.completeDate(val);
        if (completion !== null) {
          attributes.attributes[key] = completion;
        }
      } else if (val === true) {
        // try to convert tags like @today into @due(the_date)
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
      if (["critical", "high", "medium", "low", "lowest"].includes(key)) {
        // complete priority if it's an attribute value, like @high into @priority(high)
        delete attributes.attributes[key];
        attributes.attributes["priority"] = key;
      }
    });
    return attributes;
  }

  toggleTodo(line: string): string {
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

  private markToStatus = (mark: string) => {
    mark = mark.toLowerCase();
    return mark === "]" || mark === "-" || mark === "c" ? TodoStatus.Canceled : mark === ">" ? TodoStatus.InProgress : mark === "!" ? TodoStatus.AttentionRequired : mark === "x" ? TodoStatus.Complete : mark === " " ? TodoStatus.Todo : mark === "d" ? TodoStatus.Delegated : TodoStatus.Todo;
  };

  private getIndentationLevel(str: string) {
    return (str.match(/ /g)?.length || 0) + (str.match(/\t/g)?.length || 0) * 4;
  }

  toTodo<T>(line: string, lineNumber: number): TodoParsingResult<T> {
    const parsedLine = this.lineParser.parseLine(line);
    const indentLevel = this.getIndentationLevel(parsedLine.indentation);
    if (!parsedLine.checkbox)
      return {
        lineNumber,
        isTodo: false,
        indentLevel,
      };
    const attributesMatching = this.lineParser.parseAttributes(parsedLine.line);
    const todo = {
      status: this.markToStatus(parsedLine.checkbox[1]),
      text: attributesMatching.textWithoutAttributes,
      attributes: attributesMatching.attributes,
      file: undefined as unknown,
    } as TodoItem<T>;
    const res: TodoParsingResult<T> = {
      lineNumber,
      isTodo: true,
      todo,
      indentLevel: this.getIndentationLevel(parsedLine.indentation),
    };
    if (lineNumber !== undefined) {
      todo.line = lineNumber;
    }
    return res;
  }
}
