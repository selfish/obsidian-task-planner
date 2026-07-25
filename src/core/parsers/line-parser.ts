import { TaskPlannerSettings } from "../../settings";
import { AttributesStructure, LineStructure } from "../../types";
import { Completion } from "../operations/completion";

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

  // Matches Dataview [key:: value] and @key shortcuts (negative lookbehind prevents matching @ inside [[@wiki links]])
  private getAttributeRegex(): RegExp {
    return /\[([^:\]]+)::([^\]]+)\]|(?<!\[)@(\w+)(?![(\w])/g;
  }

  // Returns null for unrecognized @ shortcuts (whitelist-based parsing)
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

      if (atSettings.enablePriorityShortcuts && LineParser.PRIORITY_SHORTCUTS.includes(keyword)) {
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

  private static readonly PRIORITY_SHORTCUTS = ["critical", "high", "medium", "low", "lowest"];

  private static readonly HASHTAG_REGEX = /#([a-zA-Z][a-zA-Z0-9_-]*(?:\/[a-zA-Z0-9_-]+)*)/g;

  private parseHashtags(text: string): string[] {
    const matches = text.matchAll(LineParser.HASHTAG_REGEX);
    return Array.from(
      new Set(
        Array.from(matches, (match) => match[1]).flatMap((tag) => {
          const segments = tag.split("/");
          return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
        })
      )
    );
  }

  // Priority shortcuts like @high are converted to [priority:: high]
  parseAttributes(text: string): AttributesStructure {
    const regexp = this.getAttributeRegex();
    const matches = text.match(regexp);

    const res: Record<string, string | boolean> = {};
    const tags = this.parseHashtags(text);
    if (!matches) return { textWithoutAttributes: text, attributes: res, tags };

    let textWithoutAttributes = text;

    matches.forEach((match) => {
      const parsed = this.parseSingleAttribute(match);
      if (parsed === null) return;
      const [attrKey, attrValue] = parsed;
      if (!attrKey) return;

      if (LineParser.PRIORITY_SHORTCUTS.includes(attrKey) && attrValue === true) {
        res["priority"] = attrKey;
      } else {
        res[attrKey] = attrValue;
      }
      textWithoutAttributes = textWithoutAttributes.replace(match, "").replace(/\s+/g, " ");
    });

    return { textWithoutAttributes: textWithoutAttributes.trim(), attributes: res, tags };
  }

  attributesToString(attributesStructure: AttributesStructure): string {
    const { textWithoutAttributes, attributes } = attributesStructure;
    const attributeStr = Object.keys(attributes)
      .map((key) => {
        const val = attributes[key];
        return this.attributeToString(key, val);
      })
      .join(" ");

    return attributeStr ? `${textWithoutAttributes} ${attributeStr}`.trim() : textWithoutAttributes;
  }

  updateAttribute(text: string, key: string, value: string | boolean | undefined): string {
    const matches = [...text.matchAll(this.getAttributeRegex())];
    let result = "";
    let cursor = 0;
    let found = false;
    let written = false;

    for (const match of matches) {
      const parsed = this.parseSingleAttribute(match[0]);
      if (!parsed) continue;
      const parsedKey = LineParser.PRIORITY_SHORTCUTS.includes(parsed[0]) && parsed[1] === true ? "priority" : parsed[0];
      if (parsedKey !== key) continue;

      const start = match.index ?? 0;
      let end = start + match[0].length;
      result += text.slice(cursor, start);
      found = true;

      if (value !== false && value !== undefined && !written) {
        result += this.attributeToString(key, value);
        written = true;
      } else if (/\s$/.test(result)) {
        result = result.slice(0, -1);
      } else if (/^[ \t]/.test(text.slice(end))) {
        end++;
      }
      cursor = end;
    }

    result += text.slice(cursor);
    if (found || value === false || value === undefined) return result;
    return `${text}${text && !/\s$/.test(text) ? " " : ""}${this.attributeToString(key, value)}`;
  }

  appendTag(text: string, tag: string): string {
    const attribute = [...text.matchAll(this.getAttributeRegex())].find((match) => this.parseSingleAttribute(match[0]) !== null);
    if (!attribute) return `${text}${text && !/\s$/.test(text) ? " " : ""}#${tag}`;

    const index = attribute.index ?? text.length;
    const before = text.slice(0, index);
    const after = text.slice(index);
    return `${before}${before && !/\s$/.test(before) ? " " : ""}#${tag}${after && !/^\s/.test(after) ? " " : ""}${after}`;
  }

  private metadataSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    for (let start = 0; start < text.length; start++) {
      const opener = text[start];
      if (opener !== "[" && opener !== "(") continue;
      const closer = opener === "[" ? "]" : ")";
      let depth = 1;
      let end = start + 1;
      while (end < text.length && depth > 0) {
        if (text[end] === opener) depth++;
        else if (text[end] === closer) depth--;
        end++;
      }
      const body = text.slice(start + 1, depth === 0 ? end - 1 : end);
      if (!/^\s*[^()[\]]+::/.test(body)) continue;
      spans.push([start, end]);
      start = end - 1;
    }
    return spans;
  }

  private transformOutsideMetadata(text: string, transform: (text: string) => string): string {
    let result = "";
    let cursor = 0;
    for (const [start, end] of this.metadataSpans(text)) {
      result += transform(text.slice(cursor, start)) + text.slice(start, end);
      cursor = end;
    }
    return result + transform(text.slice(cursor));
  }

  hasTag(text: string, tag: string): boolean {
    let found = false;
    this.transformOutsideMetadata(text, (segment) => {
      found ||= Array.from(segment.matchAll(LineParser.HASHTAG_REGEX), (match) => match[1]).includes(tag);
      return segment;
    });
    return found;
  }

  removeTag(text: string, tag: string): string {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.transformOutsideMetadata(text, (segment) =>
      segment.replace(new RegExp(`(^|[ \\t])#${escaped}(?![a-zA-Z0-9_\\/-])([ \\t]?)`, "g"), (match, before: string, after: string, offset: number, whole: string) => {
        const next = whole[offset + match.length];
        return before && (after || (next && !/\s/.test(next))) ? before : "";
      })
    );
  }
}
