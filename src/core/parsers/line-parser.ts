import { TaskPlannerSettings } from "../../settings";
import { AttributesStructure, LineStructure } from "../../types";
import { Completion } from "../operations/completion";

export class LineParser {
  constructor(private settings?: TaskPlannerSettings) {}

  parseLine(line: string): LineStructure {
    const regexp = /^(\s*)?(?:([*-]|\d+\.)(\s*))?(?:(\[.?\])(\s+))?(?:((?:\d\d\d\d-)?\d\d-\d\d)(:\s*))?(.+)/;
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
    const result: LineStructure = {
      indentation: parsed[1] || "",
      listMarker: parsed[2] || "",
      checkbox: parsed[4] || "",
      date: parsed[6] || "",
      line: parsed[8] || "",
    };
    if (result.listMarker && parsed[3] !== " ") result.listMarkerSuffix = parsed[3];
    if (result.checkbox && parsed[5] !== " ") result.checkboxSuffix = parsed[5];
    if (result.date && parsed[7] !== ": ") result.dateSuffix = parsed[7];
    return result;
  }

  lineToString(line: LineStructure): string {
    const suffix = (item: string, value: string | undefined, fallback: string) => (item ? `${item}${value ?? fallback}` : "");
    return `${line.indentation}${suffix(line.listMarker, line.listMarkerSuffix, " ")}${suffix(line.checkbox, line.checkboxSuffix, " ")}${suffix(line.date, line.dateSuffix, ": ")}${line.line}`;
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

  private static readonly HASHTAG_REGEX = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;

  private parseHashtags(text: string): string[] {
    const matches = text.matchAll(LineParser.HASHTAG_REGEX);
    const tags: string[] = [];
    for (const match of matches) {
      if (!tags.includes(match[1])) {
        tags.push(match[1]);
      }
    }
    return tags;
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
    const matches = this.attributeMatches(text, key);
    if (matches.length === 0) {
      if (value === false || value === undefined) return text;
      return `${text}${text && !/\s$/.test(text) ? " " : ""}${this.attributeToString(key, value)}`;
    }

    let result = text;
    for (let index = matches.length - 1; index >= 0; index--) {
      const match = matches[index];
      const replacement = index === 0 && value !== false && value !== undefined ? this.attributeToString(key, value) : "";
      let end = match.end;
      let begin = match.start;
      if (!replacement) {
        if (begin > 0 && /[ \t]/.test(result[begin - 1])) begin--;
        else if (/[ \t]/.test(result[end] ?? "")) end++;
      }
      result = result.slice(0, begin) + replacement + result.slice(end);
    }
    return result;
  }

  private attributeMatches(text: string, key: string): { start: number; end: number }[] {
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text)];
    const metadata = this.metadataSpans(text);
    const shortcutIgnored = [...ignored, ...metadata];
    const matches = [...text.matchAll(/\[\s*([^:\]]+?)\s*::\s*([^\]]*)\]/g)]
      .filter((match) => match[1].trim().toLowerCase() === key.toLowerCase())
      .filter((match) => !this.isInside(match.index, ignored))
      .filter((match) => !metadata.some(([start, end]) => start < match.index && end >= match.index + match[0].length))
      .map((match) => ({ start: match.index, end: match.index + match[0].length }));

    const shortcutSettings = this.settings?.atShortcutSettings;
    if (!shortcutSettings || shortcutSettings.enableAtShortcuts) {
      const shortcuts: string[] = [];
      if (key.toLowerCase() === "priority" && (!shortcutSettings || shortcutSettings.enablePriorityShortcuts)) {
        shortcuts.push(...LineParser.PRIORITY_SHORTCUTS);
        if (!shortcutSettings) shortcuts.push(key);
      } else if (!shortcutSettings) {
        shortcuts.push(key);
      } else if (key.toLowerCase() === "selected" && shortcutSettings.enableBuiltinShortcuts) {
        shortcuts.push("selected");
      } else if (shortcutSettings.enableDateShortcuts && Completion.completeDate(key) !== null) {
        shortcuts.push(key);
      }
      for (const keyword of shortcuts) {
        const pattern = new RegExp(`@${this.escapeRegex(keyword)}(?!\\w)`, "gi");
        for (const match of text.matchAll(pattern)) {
          if (!this.isInside(match.index, shortcutIgnored)) matches.push({ start: match.index, end: match.index + match[0].length });
        }
      }
      for (const shortcut of shortcutSettings?.customShortcuts ?? []) {
        if (shortcut.targetAttribute.toLowerCase() !== key.toLowerCase()) continue;
        const pattern = new RegExp(`@${this.escapeRegex(shortcut.keyword)}(?!\\w)`, "gi");
        for (const match of text.matchAll(pattern)) {
          if (!this.isInside(match.index, shortcutIgnored)) matches.push({ start: match.index, end: match.index + match[0].length });
        }
      }
    }

    return Array.from(new Map(matches.map((match) => [`${match.start}:${match.end}`, match])).values()).sort((left, right) => left.start - right.start);
  }

  appendTag(text: string, tag: string): string {
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text)];
    const attribute = this.metadataSpans(text).find(([start, end]) => text[start] === "[" && text.slice(start, end).includes("::") && !this.isInside(start, ignored));
    if (!attribute) return `${text}${text && !/\s$/.test(text) ? " " : ""}#${tag}`;
    const [index] = attribute;
    const before = text.slice(0, index);
    const after = text.slice(index);
    return `${before}${before && !/\s$/.test(before) ? " " : ""}#${tag}${after && !/^\s/.test(after) ? " " : ""}${after}`;
  }

  hasTag(text: string, tag: string): boolean {
    const escaped = this.escapeRegex(tag);
    return this.outsideTagContexts(text).some((segment) => new RegExp(`#${escaped}(?![a-zA-Z0-9_/-])`).test(segment));
  }

  removeTag(text: string, tag: string): string {
    const escaped = this.escapeRegex(tag);
    return this.transformOutsideTagContexts(text, (segment) =>
      segment.replace(new RegExp(`(^|[ \\t]?)#${escaped}(?![a-zA-Z0-9_/-])([ \\t]?)`, "g"), (match, before: string, after: string, offset: number, whole: string) => {
        const next = whole[offset + match.length];
        if (!before) return after;
        return after || (next && !/\s/.test(next)) ? before : "";
      })
    );
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  private codeSpans(text: string): [number, number][] {
    return [...text.matchAll(/(`+).*?\1/g)].map((match) => [match.index, match.index + match[0].length]);
  }

  private wikiLinkSpans(text: string): [number, number][] {
    return [...text.matchAll(/\[\[.*?\]\]/g)].map((match) => [match.index, match.index + match[0].length]);
  }

  private isInside(index: number, spans: [number, number][]): boolean {
    return spans.some(([start, end]) => index >= start && index < end);
  }

  private tagContextSpans(text: string): [number, number][] {
    const spans: [number, number][] = [...this.metadataSpans(text), ...this.codeSpans(text), ...[...text.matchAll(/\[\[.*?\]\]/g)].map((match) => [match.index, match.index + match[0].length] as [number, number])].sort(([left], [right]) => left - right);
    const merged: [number, number][] = [];
    for (const [start, end] of spans) {
      const previous = merged[merged.length - 1];
      if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
      else merged.push([start, end]);
    }
    return merged;
  }

  private outsideTagContexts(text: string): string[] {
    const segments: string[] = [];
    let cursor = 0;
    for (const [start, end] of this.tagContextSpans(text)) {
      segments.push(text.slice(cursor, start));
      cursor = end;
    }
    segments.push(text.slice(cursor));
    return segments;
  }

  private transformOutsideTagContexts(text: string, transform: (segment: string) => string): string {
    let result = "";
    let cursor = 0;
    for (const [start, end] of this.tagContextSpans(text)) {
      result += transform(text.slice(cursor, start)) + text.slice(start, end);
      cursor = end;
    }
    return result + transform(text.slice(cursor));
  }
}
