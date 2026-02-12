import { TaskPlannerSettings } from "../../settings";
import { AttributesStructure, LineStructure } from "../../types";
import { Completion } from "../operations/completion";

const PRIORITY_SHORTCUTS = ["critical", "high", "medium", "low", "lowest"];
const HASHTAG_REGEX = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;

export class LineParser {
  constructor(private settings?: TaskPlannerSettings) {}

  parseLine(line: string): LineStructure {
    const regexp = /^(\s*)?(?:([*-]|\d+\.)\s*)?(?:(\[.?\])\s+)?(?:((?:\d\d\d\d-)?\d\d-\d\d):\s*)?(.+)/;
    const parsed = regexp.exec(line);
    if (!parsed) {
      return {
        indentation: "",
        listMarker: "",
        checkbox: "",
        date: "",
        line: line,
      };
    }
    return {
      indentation: parsed[1] || "",
      listMarker: parsed[2] || "",
      checkbox: parsed[3] || "",
      date: parsed[4] || "",
      line: parsed[5] || "",
    };
  }

  lineToString(line: LineStructure): string {
    const space = (item: string, char: string = " ") => (item ? `${item}${char}` : "");
    return `${line.indentation}${space(line.listMarker)}${space(line.checkbox)}${space(line.date, ": ")}${line.line}`;
  }

  private getAttributeRegex(): RegExp {
    return /\[([^:\]]+)::([^\]]+)\]|(?<!\[)@(\w+)(?![(\w])/g;
  }

  private parseSingleAttribute(matchStr: string): [string, string | boolean] | null {
    const dataviewRegex = /\[([^:\]]+)::([^\]]+)\]/;
    const dataviewMatch = dataviewRegex.exec(matchStr);
    if (dataviewMatch) {
      return [dataviewMatch[1].trim(), dataviewMatch[2].trim()];
    }

    const shortcutRegex = /@(\w+)/;
    const shortcutMatch = shortcutRegex.exec(matchStr);
    if (shortcutMatch) {
      const keyword = shortcutMatch[1].toLowerCase();
      const atSettings = this.settings?.atShortcutSettings;

      if (!atSettings) {
        return [keyword, true];
      }

      if (!atSettings.enableAtShortcuts) {
        return null;
      }

      if (atSettings.enablePriorityShortcuts && PRIORITY_SHORTCUTS.includes(keyword)) {
        return [keyword, true];
      }

      if (atSettings.enableDateShortcuts && Completion.completeDate(keyword) !== null) {
        return [keyword, true];
      }

      if (atSettings.enableBuiltinShortcuts && keyword === "selected") {
        return [keyword, true];
      }

      if (atSettings.customShortcuts) {
        const customShortcut = atSettings.customShortcuts.find((s) => s.keyword.toLowerCase() === keyword);
        if (customShortcut) {
          return [customShortcut.targetAttribute, customShortcut.value];
        }
      }

      return null;
    }

    return null;
  }

  private attributeToString(key: string, value: string | boolean): string {
    if (typeof value === "boolean") {
      return `[${key}:: true]`;
    }
    return `[${key}:: ${value}]`;
  }

  private parseHashtags(text: string): string[] {
    const tags: string[] = [];
    for (const match of text.matchAll(HASHTAG_REGEX)) {
      if (!tags.includes(match[1])) {
        tags.push(match[1]);
      }
    }
    return tags;
  }

  parseAttributes(text: string): AttributesStructure {
    const regexp = this.getAttributeRegex();
    const matches = text.match(regexp);

    const res: Record<string, string | boolean> = {};
    const tags = this.parseHashtags(text);
    if (!matches) return { textWithoutAttributes: text, attributes: res, tags };

    let textWithoutAttributes = text;

    for (const match of matches) {
      const parsed = this.parseSingleAttribute(match);
      if (parsed === null) continue;
      const [attrKey, attrValue] = parsed;
      if (!attrKey) continue;

      if (PRIORITY_SHORTCUTS.includes(attrKey) && attrValue === true) {
        res["priority"] = attrKey;
      } else {
        res[attrKey] = attrValue;
      }
      textWithoutAttributes = textWithoutAttributes.replace(match, "").replace(/\s+/g, " ");
    }

    return { textWithoutAttributes: textWithoutAttributes.trim(), attributes: res, tags };
  }

  attributesToString(attributesStructure: AttributesStructure): string {
    const { textWithoutAttributes, attributes } = attributesStructure;
    const attributeStr = Object.keys(attributes)
      .map((key) => this.attributeToString(key, attributes[key]))
      .join(" ");

    return attributeStr ? `${textWithoutAttributes} ${attributeStr}`.trim() : textWithoutAttributes;
  }
}
