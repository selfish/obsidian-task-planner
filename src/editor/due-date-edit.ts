import { Completion } from "../core/operations/completion";
import { fencedCodeBlockLines } from "../core/parsers/code-block";
import { LineParser } from "../core/parsers/line-parser";
import { TaskPlannerSettings } from "../settings/types";

const PICKER_ATTRIBUTE = "__taskPlannerDatePicker";

export function isTaskLine(document: string, line: number): boolean {
  const lines = document.split(/\r\n|\r|\n/);
  if (!lines[line] || fencedCodeBlockLines(lines).has(line)) return false;
  const parsed = new LineParser().parseLine(lines[line]);
  return Boolean(parsed.listMarker && parsed.checkbox);
}

export function dateTriggerStart(line: string, ch: number, settings: TaskPlannerSettings): number | null {
  const shortcuts = settings.atShortcutSettings;
  if (!shortcuts.enableAtShortcuts || !shortcuts.enableDateShortcuts || shortcuts.customShortcuts.some((shortcut) => shortcut.keyword.toLowerCase() === "date")) return null;
  const match = /(?:^|\s)(@date)$/i.exec(line.slice(0, ch));
  if (!match || (line[ch] && /[\w(]/.test(line[ch]))) return null;
  const start = ch - match[1].length;
  const parser = new LineParser({
    ...settings,
    atShortcutSettings: { ...shortcuts, customShortcuts: [...shortcuts.customShortcuts, { keyword: "date", targetAttribute: PICKER_ATTRIBUTE, value: true }] },
  });
  return parser.attributeMatches(line, PICKER_ATTRIBUTE).some((span) => span.start === start && span.shortcut) ? start : null;
}

export function isValidDueDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000")) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function editDueDate(line: string, date: string | null, settings: TaskPlannerSettings, triggerStart?: number): string {
  if (date !== null && !isValidDueDate(date)) throw new Error("Invalid due date");
  const parser = new LineParser(settings);
  const key = settings.dueDateAttribute;
  let result = line;
  if (triggerStart !== undefined) {
    if (dateTriggerStart(line, triggerStart + 5, settings) !== triggerStart) throw new Error("Date shortcut changed");
    result = line.slice(0, triggerStart) + (date ? `[${key}:: ${date}]` : "") + line.slice(triggerStart + 5);
  }
  // Remove recognized relative-date shortcuts so later auto-conversion cannot
  // overwrite the explicit choice. Leave priority/custom non-date text alone.
  for (const [attribute, value] of parser.parseAttributeEntries(result)) {
    if (value === true && Completion.completeDate(attribute.toLowerCase()) !== null) result = parser.updateAttribute(result, attribute, undefined, true);
  }
  return parser.updateAttribute(result, key, date ?? undefined, false, false);
}

export function currentDueDate(line: string, settings: TaskPlannerSettings): string | undefined {
  let date: string | undefined;
  for (const [key, value] of new LineParser(settings).parseAttributeEntries(line)) {
    if (key.toLowerCase() === settings.dueDateAttribute.toLowerCase() && typeof value === "string") date = Completion.completeDate(value) ?? value;
    else if (value === true) date = Completion.completeDate(key.toLowerCase()) ?? date;
  }
  return date && isValidDueDate(date) ? date : undefined;
}
