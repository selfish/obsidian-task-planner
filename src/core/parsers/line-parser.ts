import { TaskPlannerSettings } from "../../settings/types";
import { LineStructure, AttributesStructure } from "../../types/parsing";

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

  /**
   * Provide a RegExp for matching attributes, depending on the syntax settings.
   * For "classic" syntax, it's something like `@due(2024-02-02)`,
   * For "dataview" syntax, it's something like `[due:: 2024-02-02]`.
   */
  private getAttributeRegex(): RegExp {
    if (this.settings?.useDataviewSyntax) {
      // Example pattern for [key:: value]
      return /\[([^:\]]+)::([^\]]+)\]/g;
    } else {
      // Classic pattern for @key(value)
      return /@(\w+)(?:\(([^)]+)\))?/g;
    }
  }

  /**
   * Convert a matched string (like `@due(2025-01-01)` or `[due:: 2025-01-01]`)
   * into an array: `[attributeKey, attributeValueOrBoolean]`.
   */
  private parseSingleAttribute(matchStr: string): [string, string | boolean] {
    if (this.settings?.useDataviewSyntax) {
      const regex = /\[([^:\]]+)::([^\]]+)\]/;
      const submatch = regex.exec(matchStr);
      if (!submatch) {
        // fallback if something goes wrong
        return ["", false];
      }
      const key = submatch[1].trim();
      const value = submatch[2].trim();
      return [key, value];
    } else {
      // For classic syntax: "@(\w+)(?:\(([^)]+)\))?"
      const regex = /@(\w+)(?:\(([^)]+)\))?/;
      const submatch = regex.exec(matchStr);
      if (!submatch) {
        return ["", false];
      }
      const key = submatch[1].trim();
      const val = submatch[2] ? submatch[2].trim() : true;
      return [key, val];
    }
  }

  /**
   * Convert a single `key` and `value` into a string
   * according to the currently used syntax.
   *
   * e.g. with classic syntax:
   *   if value is boolean => `@due`
   *   if value is string  => `@due(2025-01-01)`
   * e.g. with dataview syntax:
   *   `[due:: 2025-01-01]`
   */
  private attributeToString(key: string, value: string | boolean): string {
    if (this.settings?.useDataviewSyntax) {
      // For Dataview: `[key:: value]`
      // In case value is boolean (like a tag), just store the key or do some fallback
      if (typeof value === "boolean") {
        // Maybe store `[key:: true]` or skip it—decide how you want it.
        return `[${key}:: true]`;
      }
      return `[${key}:: ${value}]`;
    } else {
      // For classic: `@key` or `@key(value)`
      if (typeof value === "boolean") {
        return `@${key}`;
      }
      return `@${key}(${value})`;
    }
  }

  /**
   * Parse the attributes from a given line, removing those attribute tokens
   * from the text and returning a map of { key -> value } plus the stripped text.
   */
  parseAttributes(text: string): AttributesStructure {
    const regexp = this.getAttributeRegex();
    const matches = text.match(regexp);

    const res: Record<string, string | boolean> = {};
    if (!matches) return { textWithoutAttributes: text, attributes: res };

    let textWithoutAttributes = text;

    matches.forEach((match) => {
      const [attrKey, attrValue] = this.parseSingleAttribute(match);
      if (!attrKey) return; // skip if something invalid

      res[attrKey] = attrValue;
      // Remove that chunk from the text
      textWithoutAttributes = textWithoutAttributes.replace(match, "");
    });

    return { textWithoutAttributes: textWithoutAttributes.trim(), attributes: res };
  }

  /**
   * Build a single string from `textWithoutAttributes` + the attributes' dictionary.
   * E.g. "Buy milk" + { due: "2025-01-01", critical: true }
   * => "Buy milk @due(2025-01-01) @critical"
   * or => "Buy milk [due:: 2025-01-01] [critical:: true]"
   */
  attributesToString(attributesStructure: AttributesStructure): string {
    const { textWithoutAttributes, attributes } = attributesStructure;
    const attributeStr = Object.keys(attributes)
      .map((key) => {
        const val = attributes[key];
        return this.attributeToString(key, val);
      })
      .join(" ");

    // add a space only if there are attributes
    return attributeStr ? `${textWithoutAttributes} ${attributeStr}`.trim() : textWithoutAttributes;
  }
}
