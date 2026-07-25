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

  // Returns null for unrecognized @ shortcuts (whitelist-based parsing)
  private parseSingleAttribute(matchStr: string): [string, string | boolean] | null {
    const dataviewRegex = /^\[([^:\]]+)::\s*(.*)\]$/;
    const dataviewMatch = dataviewRegex.exec(matchStr);
    if (dataviewMatch) {
      const key = dataviewMatch[1].trim();
      const value = dataviewMatch[2].trim();
      if (!key || !value) return null;
      return [key, value];
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

  concreteTags(text: string): string[] {
    const tags = new Set<string>();
    this.transformOutsideTagContexts(text, (segment) => {
      for (const match of segment.matchAll(LineParser.HASHTAG_REGEX)) tags.add(match[1]);
      return segment;
    });
    return [...tags];
  }

  private parseHashtags(text: string): string[] {
    const tags = new Set<string>();
    for (const concreteTag of this.concreteTags(text)) {
      for (const tag of concreteTag.split("/").map((_, index, segments) => segments.slice(0, index + 1).join("/"))) tags.add(tag);
    }
    return [...tags];
  }

  // Priority shortcuts like @high are converted to [priority:: high]
  parseAttributes(text: string): AttributesStructure {
    const matches = this.attributeMatches(text);

    const res: Record<string, string | boolean> = {};
    const tags = this.parseHashtags(text);
    if (matches.length === 0) return { textWithoutAttributes: text, attributes: res, tags };

    let textWithoutAttributes = text;

    const removals: typeof matches = [];
    matches.forEach((match) => {
      const parsed = this.parseSingleAttribute(match.value);
      if (parsed === null) return;
      const [attrKey, attrValue] = parsed;
      if (!attrKey) return;

      if (LineParser.PRIORITY_SHORTCUTS.includes(attrKey) && attrValue === true) {
        res["priority"] = attrKey;
      } else {
        res[attrKey] = attrValue;
      }
      removals.push(match);
    });
    for (const match of removals.sort((a, b) => b.index - a.index)) {
      textWithoutAttributes = textWithoutAttributes.slice(0, match.index) + textWithoutAttributes.slice(match.index + match.value.length);
    }

    return { textWithoutAttributes: textWithoutAttributes.replace(/\s+/g, " ").trim(), attributes: res, tags };
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
    const matches = this.attributeMatches(text);
    let result = "";
    let cursor = 0;
    let found = false;
    let written = false;

    for (const match of matches) {
      const parsed = this.parseSingleAttribute(match.value);
      if (!parsed) continue;
      const parsedKey = LineParser.PRIORITY_SHORTCUTS.includes(parsed[0]) && parsed[1] === true ? "priority" : parsed[0];
      if (parsedKey !== key) continue;

      const start = match.index;
      let end = start + match.value.length;
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
    const attribute = this.attributeMatches(text).find((match) => this.parseSingleAttribute(match.value) !== null);
    if (!attribute) return `${text}${text && !/\s$/.test(text) ? " " : ""}#${tag}`;

    const index = attribute.index;
    const before = text.slice(0, index);
    const after = text.slice(index);
    return `${before}${before && !/\s$/.test(before) ? " " : ""}#${tag}${after && !/^\s/.test(after) ? " " : ""}${after}`;
  }

  private metadataSpans(text: string): [number, number, boolean][] {
    const spans: [number, number, boolean][] = [];
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
      spans.push([start, end, depth === 0]);
      start = end - 1;
    }
    return spans;
  }

  private attributeMatches(text: string): { value: string; index: number }[] {
    const ignored = [...this.codeSpans(text), ...this.wikilinkSpans(text)];
    const contexts = this.metadataSpans(text);
    const spans = contexts.filter(([start, end, balanced]) => balanced && !ignored.some(([ignoredStart, ignoredEnd]) => (start >= ignoredStart && start < ignoredEnd) || (end > ignoredStart && end <= ignoredEnd)));
    const attributes = spans.filter(([start, end]) => text[start] === "[" && this.parseSingleAttribute(text.slice(start, end)) !== null).map(([start, end]) => ({ value: text.slice(start, end), index: start }));
    const shortcuts = [...text.matchAll(/(?<!\[)@(\w+)(?![(\w])/g)]
      .filter((match) => {
        const { index } = match;
        return ![...contexts, ...ignored].some(([start, end]) => index >= start && index < end);
      })
      .map((match) => ({ value: match[0], index: match.index }));
    return [...attributes, ...shortcuts].sort((a, b) => a.index - b.index);
  }

  private codeSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    for (let start = 0; start < text.length; start++) {
      if (text[start] !== "`") continue;
      let markerEnd = start + 1;
      while (text[markerEnd] === "`") markerEnd++;
      const marker = text.slice(start, markerEnd);
      let end = text.indexOf(marker, markerEnd);
      while (end !== -1 && (text[end - 1] === "`" || text[end + marker.length] === "`")) end = text.indexOf(marker, end + 1);
      if (end === -1) {
        start = markerEnd - 1;
        continue;
      }
      spans.push([start, end + marker.length]);
      start = end + marker.length - 1;
    }
    return spans;
  }

  private wikilinkSpans(text: string): [number, number][] {
    return [...text.matchAll(/\[\[.*?\]\]/g)].map((match) => [match.index, match.index + match[0].length]);
  }

  private tagContextSpans(text: string): [number, number][] {
    const spans = [...this.metadataSpans(text).map(([start, end]) => [start, end] as [number, number]), ...this.codeSpans(text), ...this.wikilinkSpans(text)];
    spans.sort(([left], [right]) => left - right);

    const merged: [number, number][] = [];
    for (const [start, end] of spans) {
      const previous = merged[merged.length - 1];
      if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
      else merged.push([start, end]);
    }
    return merged;
  }

  private transformOutsideTagContexts(text: string, transform: (text: string) => string): string {
    let result = "";
    let cursor = 0;
    for (const [start, end] of this.tagContextSpans(text)) {
      result += transform(text.slice(cursor, start)) + text.slice(start, end);
      cursor = end;
    }
    return result + transform(text.slice(cursor));
  }

  hasTag(text: string, tag: string): boolean {
    let found = false;
    this.transformOutsideTagContexts(text, (segment) => {
      found ||= Array.from(segment.matchAll(LineParser.HASHTAG_REGEX), (match) => match[1]).includes(tag);
      return segment;
    });
    return found;
  }

  removeTag(text: string, tag: string): string {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.transformOutsideTagContexts(text, (segment) =>
      segment.replace(new RegExp(`(^|[ \\t])#${escaped}(?![a-zA-Z0-9_\\/-])([ \\t]?)`, "g"), (match, before: string, after: string, offset: number, whole: string) => {
        const next = whole[offset + match.length];
        return before && (after || (next && !/\s/.test(next))) ? before : "";
      })
    );
  }
}
