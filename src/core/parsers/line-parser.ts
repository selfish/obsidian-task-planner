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
  private static readonly ESCAPABLE_PUNCTUATION = /[!-/:-@[-`{-~]/;

  private parseHashtags(text: string): string[] {
    const tags: string[] = [];
    for (const segment of this.outsideTagContexts(text)) {
      for (const match of segment.matchAll(LineParser.HASHTAG_REGEX)) {
        if (!tags.includes(match[1])) tags.push(match[1]);
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
    if (accepted.length === 0) return { textWithoutAttributes: text, attributes: res, tags };
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
    const ignored = this.mergeSpans([...this.codeSpans(text), ...this.wikiLinkSpans(text), ...this.angleContextSpans(text), ...this.uriSpans(text), ...this.emailSpans(text)]);
    const containers = this.delimiterSpans(text, ignored);
    const accepted: { match: RegExpMatchArray; key: string; value: string | boolean }[] = [];
    for (const match of matches) {
      if (this.isInside(match.index, ignored) || this.isEscaped(text, match.index)) continue;
      const opener = match[0][0];
      if (opener === "[" || opener === "(") {
        const separator = match.index + match[0].indexOf("::");
        if (this.isEscaped(text, separator) || this.isEscaped(text, separator + 1)) continue;
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
    const ignored = this.mergeSpans([...this.codeSpans(text), ...this.wikiLinkSpans(text), ...this.angleContextSpans(text), ...this.uriSpans(text), ...this.emailSpans(text)]);
    const containers = this.delimiterSpans(text, ignored);
    const matches: { start: number; end: number; parenthesized?: boolean; shortcut?: boolean }[] = [...text.matchAll(/\[\s*([^:[\]]+?)\s*::\s*([^[\]]*)\]|\(\s*([^:()[\]]+?)\s*::\s*([^()[\]]*)\)/g)]
      .filter((match) => this.parseSingleAttribute(match[0]) !== null)
      .filter((match) => (match[1] ?? match[3]).trim().toLowerCase() === key.toLowerCase())
      .filter((match) => !this.isInside(match.index, ignored) && !this.isEscaped(text, match.index))
      .filter((match) => {
        const separator = match.index + match[0].indexOf("::");
        return !this.isEscaped(text, separator) && !this.isEscaped(text, separator + 1);
      })
      .filter((match) => containers.some(([start, end]) => start === match.index && end === match.index + match[0].length))
      .map((match) => ({ start: match.index, end: match.index + match[0].length, parenthesized: match[0][0] === "(" }));

    for (const { match, key: shortcutKey, value } of this.acceptedAttributes(text)) {
      if (match[0][0] !== "@") continue;
      const target = value === true && LineParser.PRIORITY_SHORTCUTS.includes(shortcutKey) ? "priority" : shortcutKey;
      if (target.toLowerCase() === key.toLowerCase()) matches.push({ start: match.index, end: match.index + match[0].length, shortcut: true });
    }

    return Array.from(new Map(matches.map((match) => [`${match.start}:${match.end}`, match])).values()).sort((left, right) => left.start - right.start);
  }

  appendTag(text: string, tag: string): string {
    const ignored = this.mergeSpans([...this.codeSpans(text), ...this.wikiLinkSpans(text)]);
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

  private isEscaped(text: string, index: number): boolean {
    let backslashes = 0;
    while (text[--index] === "\\") backslashes++;
    return backslashes % 2 === 1;
  }

  private delimiterSpans(text: string, ignored: [number, number][]): [number, number][] {
    const spans: [number, number][] = [];
    ignored.sort(([left], [right]) => left - right);
    let ignoredIndex = 0;
    const ignoredEnd = (index: number): number | undefined => {
      while (ignoredIndex < ignored.length && index >= ignored[ignoredIndex][1]) ignoredIndex++;
      const span = ignored[ignoredIndex];
      return span && index >= span[0] ? span[1] : undefined;
    };
    for (let start = 0; start < text.length; start++) {
      const skipTo = ignoredEnd(start);
      if (skipTo !== undefined) {
        start = skipTo - 1;
        continue;
      }
      const opener = text[start];
      if (opener !== "[" && opener !== "(") continue;
      if (this.isEscaped(text, start)) continue;
      const closer = opener === "[" ? "]" : ")";
      let depth = 1;
      let end = start + 1;
      while (end < text.length && depth > 0) {
        const skipTo = ignoredEnd(end);
        if (skipTo !== undefined) {
          end = skipTo;
          continue;
        }
        if (text[end] === opener && !this.isEscaped(text, end)) depth++;
        else if (text[end] === closer && !this.isEscaped(text, end)) depth--;
        end++;
      }
      spans.push([start, end]);
      start = end - 1;
    }
    return spans;
  }

  private metadataSpans(text: string): [number, number][] {
    const candidates: [number, number][] = [];
    const squareStack: number[] = [];
    const roundStack: number[] = [];
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text), ...this.angleContextSpans(text)].sort(([left], [right]) => left - right);
    let ignoredIndex = 0;
    for (let index = 0; index < text.length; index++) {
      while (ignoredIndex < ignored.length && index >= ignored[ignoredIndex][1]) ignoredIndex++;
      if (ignored[ignoredIndex] && index >= ignored[ignoredIndex][0]) {
        index = ignored[ignoredIndex][1] - 1;
        continue;
      }
      if (this.isEscaped(text, index)) continue;
      if (text[index] === "[") squareStack.push(index);
      else if (text[index] === "(") roundStack.push(index);
      else if (text[index] === "]") {
        const start = squareStack.pop();
        if (start !== undefined) candidates.push([start, index + 1]);
      } else if (text[index] === ")") {
        const start = roundStack.pop();
        if (start !== undefined) candidates.push([start, index + 1]);
      }
    }
    for (const start of squareStack) candidates.push([start, text.length]);
    for (const start of roundStack) candidates.push([start, text.length]);

    candidates.sort(([leftStart], [rightStart]) => leftStart - rightStart);
    const spans: [number, number][] = [];
    let coveredUntil = -1;
    for (const [start, end] of candidates) {
      if (start >= coveredUntil && this.isMetadataSpan(text, start, end)) {
        spans.push([start, end]);
        coveredUntil = end;
      }
    }
    return spans;
  }

  private topLevelMetadataSpans(text: string): [number, number][] {
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text), ...this.angleContextSpans(text)];
    return this.delimiterSpans(text, ignored).filter(([start, end]) => this.isMetadataSpan(text, start, end));
  }

  private isMetadataSpan(text: string, start: number, end: number): boolean {
    const closer = text[start] === "[" ? "]" : ")";
    const limit = text[end - 1] === closer ? end - 1 : end;
    let index = start + 1;
    while (index < limit && /\s/.test(text[index])) index++;
    for (; index < limit && !/[()[\]]/.test(text[index]); index++) {
      if (text[index] === ":" && text[index + 1] === ":" && !this.isEscaped(text, index) && !this.isEscaped(text, index + 1)) return true;
    }
    return false;
  }

  private codeSpans(text: string): [number, number][] {
    return [...text.matchAll(/(`+).*?\1/g)].map((match) => [match.index, match.index + match[0].length]);
  }

  private wikiLinkSpans(text: string): [number, number][] {
    return [...text.matchAll(/\[\[.*?\]\]/g)].map((match) => [match.index, match.index + match[0].length]);
  }

  private angleContextSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    for (const [open, close] of [
      ["<!--", "-->"],
      ["<?", "?>"],
      ["<![CDATA[", "]]>"],
    ]) {
      let start = 0;
      while ((start = text.indexOf(open, start)) >= 0) {
        const end = text.indexOf(close, start + open.length);
        if (end < 0) break;
        spans.push([start, end + close.length]);
        start = end + close.length;
      }
    }
    let declaration = 0;
    while ((declaration = text.indexOf("<!", declaration)) >= 0) {
      if (!/[A-Za-z]/.test(text.charAt(declaration + 2))) {
        declaration += 2;
        continue;
      }
      const end = text.indexOf(">", declaration + 3);
      if (end < 0) break;
      spans.push([declaration, end + 1]);
      declaration = end + 1;
    }
    const opaque = /<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>|<[^\s<>]+@[^\s<>]+>/g;
    const tags = /<\/?[A-Za-z](?:"[^"]*"|'[^']*'|[^'"<>])*?>/g;
    spans.push(...[...text.matchAll(opaque), ...text.matchAll(tags)].map((match): [number, number] => [match.index, match.index + match[0].length]));
    spans.sort(([left], [right]) => left - right);
    const merged: [number, number][] = [];
    for (const [start, end] of spans) {
      const previous = merged[merged.length - 1];
      if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
      else merged.push([start, end]);
    }
    return merged;
  }

  private markdownLinkDestinationSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    const ignored = [...this.codeSpans(text), ...this.wikiLinkSpans(text), ...this.angleContextSpans(text)].sort(([left], [right]) => left - right);
    const escaped = new Uint8Array(text.length);
    for (let index = 0; index < text.length - 1; index++) {
      if (text[index] === "\\" && !escaped[index] && LineParser.ESCAPABLE_PUNCTUATION.test(text[index + 1])) escaped[index + 1] = 1;
    }
    const brackets: { containsLink: boolean; image: boolean }[] = [];
    let ignoredIndex = 0;
    for (let index = 0; index < text.length; index++) {
      while (ignoredIndex < ignored.length && index >= ignored[ignoredIndex][1]) ignoredIndex++;
      if (ignored[ignoredIndex] && index >= ignored[ignoredIndex][0]) {
        index = ignored[ignoredIndex][1] - 1;
        continue;
      }
      if (escaped[index]) continue;
      if (text[index] === "[") brackets.push({ containsLink: false, image: text[index - 1] === "!" && !escaped[index - 1] });
      else if (text[index] === "]") {
        const label = brackets.pop();
        if (!label || label.containsLink || text[index + 1] !== "(") continue;
        const end = this.markdownLinkDestinationEnd(text, index + 2);
        if (end === undefined) continue;
        spans.push([index + 2, end]);
        if (!label.image) {
          for (let bracket = brackets.length - 1; bracket >= 0 && !brackets[bracket].image; bracket--) brackets[bracket].containsLink = true;
        }
        index = end;
      }
    }
    return spans;
  }

  private markdownLinkDestinationEnd(text: string, start: number): number | undefined {
    let index = start;
    while (/\s/.test(text.charAt(index))) index++;
    if (text[index] === "<") {
      for (index++; index < text.length && text[index] !== ">"; index++) {
        if (text[index] === "\\" && LineParser.ESCAPABLE_PUNCTUATION.test(text.charAt(index + 1))) index++;
        else if (text[index] === "<" || /[\r\n]/.test(text[index])) return undefined;
      }
      if (text[index] !== ">") return undefined;
      index++;
    } else {
      let depth = 0;
      while (index < text.length && !/\s/.test(text[index])) {
        if (text[index] === "\\" && LineParser.ESCAPABLE_PUNCTUATION.test(text.charAt(index + 1))) index += 2;
        else if (text[index] === "<" || text[index] === ">") return undefined;
        else if (text[index] === "(") {
          if (depth === 32) return undefined; // CommonMark's nesting limit also bounds malformed-input work.
          depth++;
          index++;
        } else if (text[index] === ")") {
          if (depth === 0) return index;
          depth--;
          index++;
        } else index++;
      }
      if (depth > 0) return undefined;
    }
    if (text[index] === ")") return index;
    if (!/\s/.test(text.charAt(index))) return undefined;
    while (/\s/.test(text.charAt(index))) index++;
    if (text[index] === ")") return index;

    const titleEnd = text[index] === "(" ? ")" : text[index] === '"' || text[index] === "'" ? text[index] : undefined;
    if (!titleEnd) return undefined;
    for (index++; index < text.length && text[index] !== titleEnd; index++) {
      if (text[index] === "\\" && LineParser.ESCAPABLE_PUNCTUATION.test(text.charAt(index + 1))) index++;
      else if (titleEnd === ")" && text[index] === "(") return undefined;
    }
    if (text[index] !== titleEnd) return undefined;
    index++;
    if (!/\s|\)/.test(text.charAt(index))) return undefined;
    while (/\s/.test(text.charAt(index))) index++;
    return text[index] === ")" ? index : undefined;
  }

  private uriSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    const uriStart = /\b[a-z][a-z0-9+.-]*:(?!:)/gi;
    let match: RegExpExecArray | null;
    while ((match = uriStart.exec(text))) {
      if (text[match.index - 1] === "#") continue;
      let end = match.index + match[0].length;
      let parentheses = 0;
      let squares = 0;
      while (end < text.length && !/(?:\s|[<>"'`{}])/.test(text[end])) {
        if (text[end] === "(") parentheses++;
        else if (text[end] === ")") {
          if (parentheses === 0) break;
          parentheses--;
        } else if (text[end] === "[") squares++;
        else if (text[end] === "]") {
          if (squares === 0) break;
          squares--;
        }
        end++;
      }
      spans.push([match.index, end]);
      uriStart.lastIndex = end;
    }
    return spans;
  }

  private emailSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    const domains = /@[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?)+/gu;
    for (const domain of text.matchAll(domains)) {
      let start = domain.index;
      if (text[start - 1] === '"') {
        let escapes = 0;
        for (let index = start - 2; text[index] === "\\"; index--) escapes++;
        if (escapes % 2) continue;
        for (start -= 2; start >= 0; start--) {
          if (text[start] !== '"') continue;
          escapes = 0;
          for (let index = start - 1; text[index] === "\\"; index--) escapes++;
          if (escapes % 2 === 0) break;
        }
        if (start < 0) continue;
      } else {
        while (start > 0 && !/[\s"(),:;<>@[\]\\]/u.test(text[start - 1])) start--;
        const local = text.slice(start, domain.index);
        if (!local || local.startsWith(".") || local.endsWith(".") || local.includes("..")) continue;
      }
      spans.push([start, domain.index + domain[0].length]);
    }
    return spans;
  }

  private escapedHashSpans(text: string): [number, number][] {
    const spans: [number, number][] = [];
    let backslashes = 0;
    for (let index = 0; index < text.length; index++) {
      if (text[index] === "\\") {
        backslashes++;
        continue;
      }
      if (text[index] === "#" && backslashes % 2 === 1) spans.push([index, index + 1]);
      backslashes = 0;
    }
    return spans;
  }

  private mergeSpans(spans: [number, number][]): [number, number][] {
    spans.sort(([left], [right]) => left - right);
    const merged: [number, number][] = [];
    for (const [start, end] of spans) {
      const previous = merged[merged.length - 1];
      if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
      else merged.push([start, end]);
    }
    return merged;
  }

  private isInside(index: number, spans: [number, number][]): boolean {
    let low = 0;
    let high = spans.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const [start, end] = spans[middle];
      if (index < start) high = middle - 1;
      else if (index >= end) low = middle + 1;
      else return true;
    }
    return false;
  }

  private tagContextSpans(text: string): [number, number][] {
    const spans: [number, number][] = [...this.metadataSpans(text), ...this.codeSpans(text), ...this.wikiLinkSpans(text), ...this.markdownLinkDestinationSpans(text), ...this.uriSpans(text), ...this.escapedHashSpans(text)].sort(([left], [right]) => left - right);
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
