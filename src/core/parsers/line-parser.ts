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

  // Matches Dataview [key:: value], Dataview (key:: value), and @key shortcuts.
  private getAttributeRegex(): RegExp {
    return /\[([^:[\]]+)::((?:(?!\[|\]).)+)\]|\(([^:()[\]]+)::([^()[\]]+)\)|(?<!\[)@(\w+)(?![(\w])/g;
  }

  // Returns null for unrecognized @ shortcuts (whitelist-based parsing)
  private parseSingleAttribute(matchStr: string): [string, string | boolean] | null {
    const dataviewRegex = /\[([^:[\]]+)::((?:(?!\[|\]).)+)\]|\(([^:()[\]]+)::([^()[\]]+)\)/;
    const dataviewMatch = dataviewRegex.exec(matchStr);
    if (dataviewMatch) {
      const key = (dataviewMatch[1] ?? dataviewMatch[3]).trim();
      const value = (dataviewMatch[2] ?? dataviewMatch[4]).trim();
      return key && value ? [key, value] : null;
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

  private attributeToString(key: string, value: string | boolean, parenthesized = false): string {
    const [open, close] = parenthesized ? ["(", ")"] : ["[", "]"];
    if (typeof value === "boolean") {
      return `${open}${key}:: true${close}`;
    }
    return `${open}${key}:: ${value}${close}`;
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
    const matches = [...text.matchAll(this.getAttributeRegex())];

    const res: Record<string, string | boolean> = {};
    const tags = this.parseHashtags(text);
    if (matches.length === 0) return { textWithoutAttributes: text, attributes: res, tags };

    const accepted = this.acceptedAttributes(text, matches);
    accepted.forEach(({ key: attrKey, value: attrValue }) => {
      if (LineParser.PRIORITY_SHORTCUTS.includes(attrKey) && attrValue === true) {
        res["priority"] = attrKey;
      } else {
        res[attrKey] = attrValue;
      }
    });

    let textWithoutAttributes = text;
    for (let index = accepted.length - 1; index >= 0; index--) {
      const match = accepted[index].match;
      textWithoutAttributes = textWithoutAttributes.slice(0, match.index) + textWithoutAttributes.slice(match.index + match[0].length);
    }
    textWithoutAttributes = textWithoutAttributes.replace(/\s+/g, " ");

    return { textWithoutAttributes: textWithoutAttributes.trim(), attributes: res, tags };
  }

  parseAttributeEntries(text: string): [string, string | boolean][] {
    return this.acceptedAttributes(text).map(({ key, value }) => [key, value]);
  }

  private acceptedAttributes(text: string, matches: RegExpMatchArray[] = [...text.matchAll(this.getAttributeRegex())]): { match: RegExpMatchArray; key: string; value: string | boolean }[] {
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text)];
    const containers = this.delimiterSpans(text, ignored);
    const accepted: { match: RegExpMatchArray; key: string; value: string | boolean }[] = [];
    for (const match of matches) {
      if (this.isInside(match.index, ignored)) continue;
      const opener = match[0][0];
      if (opener === "[" || opener === "(") {
        if (!containers.some(([start, end]) => start === match.index && end === match.index + match[0].length)) continue;
      } else if (this.isInside(match.index, containers)) {
        continue;
      }
      const parsed = this.parseSingleAttribute(match[0]);
      if (parsed === null || !parsed[0]) continue;
      accepted.push({ match, key: parsed[0], value: parsed[1] });
    }
    return accepted;
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

  updateAttribute(text: string, key: string, value: string | boolean | undefined, onlyShortcuts = false, preserveDuplicates = true): string {
    const allMatches = this.attributeMatches(text, key);
    let matches = onlyShortcuts ? allMatches.filter((match) => match.shortcut) : allMatches;
    if (matches.length === 0) {
      if (onlyShortcuts || value === false || value === undefined) return text;
      return `${text}${text && !/\s$/.test(text) ? " " : ""}${this.attributeToString(key, value)}`;
    }

    let replacementMatch = value !== false && value !== undefined ? matches[0] : undefined;
    if ((onlyShortcuts || preserveDuplicates) && replacementMatch) {
      const metadataMatches = allMatches.filter((match) => !match.shortcut);
      if (metadataMatches.length > 0) {
        const lastMetadata = metadataMatches[metadataMatches.length - 1];
        const parsedMetadata = this.parseSingleAttribute(text.slice(lastMetadata.start, lastMetadata.end));
        if (onlyShortcuts && parsedMetadata?.[1] === value) {
          replacementMatch = undefined;
        } else {
          matches = allMatches.filter((match) => match.shortcut || match === lastMetadata);
          replacementMatch = lastMetadata;
        }
      } else if (preserveDuplicates) {
        replacementMatch = matches[matches.length - 1];
      }
    }

    let result = text;
    for (let index = matches.length - 1; index >= 0; index--) {
      const match = matches[index];
      const replacementKey = match.shortcut ? key : (this.parseSingleAttribute(text.slice(match.start, match.end))?.[0] ?? key);
      const replacement = match === replacementMatch && value !== false && value !== undefined ? this.attributeToString(replacementKey, value, match.parenthesized) : "";
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

  private attributeMatches(text: string, key: string): { start: number; end: number; parenthesized?: boolean; shortcut?: boolean }[] {
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text)];
    const containers = this.delimiterSpans(text, ignored);
    const shortcutIgnored = [...ignored, ...containers];
    const matches: { start: number; end: number; parenthesized?: boolean; shortcut?: boolean }[] = [...text.matchAll(/\[\s*([^:[\]]+?)\s*::\s*([^[\]]*)\]|\(\s*([^:()[\]]+?)\s*::\s*([^()[\]]*)\)/g)]
      .filter((match) => this.parseSingleAttribute(match[0]) !== null)
      .filter((match) => (match[1] ?? match[3]).trim().toLowerCase() === key.toLowerCase())
      .filter((match) => !this.isInside(match.index, ignored))
      .filter((match) => containers.some(([start, end]) => start === match.index && end === match.index + match[0].length))
      .map((match) => ({ start: match.index, end: match.index + match[0].length, parenthesized: match[0][0] === "(" }));

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
        const pattern = new RegExp(`@${this.escapeRegex(keyword)}(?![(\\w])`, "gi");
        for (const match of text.matchAll(pattern)) {
          if (!this.isInside(match.index, shortcutIgnored)) matches.push({ start: match.index, end: match.index + match[0].length, shortcut: true });
        }
      }
      for (const shortcut of shortcutSettings?.customShortcuts ?? []) {
        if (shortcut.targetAttribute.toLowerCase() !== key.toLowerCase()) continue;
        if (!/^\w+$/.test(shortcut.keyword)) continue;
        const resolved = this.parseSingleAttribute(`@${shortcut.keyword}`);
        if (resolved === null || resolved[0].toLowerCase() !== shortcut.targetAttribute.toLowerCase() || resolved[1] !== shortcut.value) continue;
        const pattern = new RegExp(`@${this.escapeRegex(shortcut.keyword)}(?![(\\w])`, "gi");
        for (const match of text.matchAll(pattern)) {
          if (!this.isInside(match.index, shortcutIgnored)) matches.push({ start: match.index, end: match.index + match[0].length, shortcut: true });
        }
      }
    }

    return Array.from(new Map(matches.map((match) => [`${match.start}:${match.end}`, match])).values()).sort((left, right) => left.start - right.start);
  }

  appendTag(text: string, tag: string): string {
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text)];
    const attribute = this.topLevelMetadataSpans(text).find(([start, end]) => {
      const closer = text[start] === "[" ? "]" : ")";
      return text[end - 1] === closer && text.slice(start, end).includes("::") && !this.isInside(start, ignored);
    });
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

  private delimiterSpans(text: string, ignored: [number, number][]): [number, number][] {
    const spans: [number, number][] = [];
    for (let start = 0; start < text.length; start++) {
      const opener = text[start];
      if ((opener !== "[" && opener !== "(") || this.isInside(start, ignored)) continue;
      const closer = opener === "[" ? "]" : ")";
      let depth = 1;
      let end = start + 1;
      while (end < text.length && depth > 0) {
        if (this.isInside(end, ignored)) {
          end++;
          continue;
        }
        if (text[end] === opener) depth++;
        else if (text[end] === closer) depth--;
        end++;
      }
      spans.push([start, end]);
      start = end - 1;
    }
    return spans;
  }

  private metadataSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text)];
    for (let start = 0; start < text.length; start++) {
      const opener = text[start];
      if ((opener !== "[" && opener !== "(") || this.isInside(start, ignored)) continue;
      const closer = opener === "[" ? "]" : ")";
      let depth = 1;
      let end = start + 1;
      while (end < text.length && depth > 0) {
        if (this.isInside(end, ignored)) {
          end++;
          continue;
        }
        if (text[end] === opener) depth++;
        else if (text[end] === closer) depth--;
        end++;
      }
      if (!this.isMetadataSpan(text, start, end)) continue;
      spans.push([start, end]);
      start = end - 1;
    }
    return spans;
  }

  private topLevelMetadataSpans(text: string): [number, number][] {
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text)];
    return this.delimiterSpans(text, ignored).filter(([start, end]) => this.isMetadataSpan(text, start, end));
  }

  private isMetadataSpan(text: string, start: number, end: number): boolean {
    const closer = text[start] === "[" ? "]" : ")";
    const body = text.slice(start + 1, text[end - 1] === closer ? end - 1 : end);
    return /^\s*[^()[\]]+::/.test(body);
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
