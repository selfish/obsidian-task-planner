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
   * Provide a RegExp for matching Dataview attributes: `[key:: value]`
   */
  private getAttributeRegex(): RegExp {
    return /\[([^:\]]+)::([^\]]+)\]/g;
  }

  /**
   * Convert a matched Dataview string `[key:: value]` into `[attributeKey, attributeValue]`.
   */
  private parseSingleAttribute(matchStr: string): [string, string | boolean] {
    const regex = /\[([^:\]]+)::([^\]]+)\]/;
    const submatch = regex.exec(matchStr);
    if (!submatch) {
      return ["", false];
    }
    return [submatch[1].trim(), submatch[2].trim()];
  }

  /**
   * Convert a single `key` and `value` into Dataview format: `[key:: value]`
   */
  private attributeToString(key: string, value: string | boolean): string {
    if (typeof value === "boolean") {
      return `[${key}:: true]`;
    }
    return `[${key}:: ${value}]`;
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
   * => "Buy milk [due:: 2025-01-01] [critical:: true]"
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
