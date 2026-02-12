import { TaskItem } from "../../types";

export class TaskMatcher<T> {
  private matchTerm: string;
  private regex: RegExp;

  constructor(
    matchTerm: string,
    private fuzzySearch = false
  ) {
    this.matchTerm = matchTerm.toLowerCase();
    this.matches = this.matches.bind(this);
    const escapedTerm = matchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    this.regex = RegExp(escapedTerm, "gi");
  }

  matches(task: TaskItem<T>): boolean {
    if (!this.matchTerm) {
      return true;
    }
    return this.fuzzySearch ? this.fuzzyMatch(task) : this.exactMatch(task);
  }

  private exactMatch(task: TaskItem<T>): boolean {
    return task.text.search(this.regex) >= 0;
  }

  private fuzzyMatch(task: TaskItem<T>): boolean {
    const taskText = task.text.toLowerCase();
    const searchChars = this.matchTerm.replace(/\s/g, "");

    if (searchChars.length === 0) return true;

    const wordStarts = new Set<number>();
    wordStarts.add(0);
    for (let i = 1; i < taskText.length; i++) {
      const prevChar = taskText[i - 1];
      if (!/[a-z0-9]/.test(prevChar)) {
        wordStarts.add(i);
      }
    }

    return this.fuzzyMatchFrom(taskText, searchChars, 0, 0, wordStarts, true);
  }

  private fuzzyMatchFrom(text: string, search: string, textIdx: number, searchIdx: number, wordStarts: Set<number>, mustBeWordStart: boolean): boolean {
    if (searchIdx >= search.length) return true;
    if (textIdx >= text.length) return false;

    const searchChar = search[searchIdx];

    for (let i = textIdx; i < text.length; i++) {
      if (text[i] !== searchChar) continue;

      const isWordStart = wordStarts.has(i);
      const isConsecutive = i === textIdx;

      if (mustBeWordStart && !isWordStart) continue;
      if (!mustBeWordStart && !isConsecutive && !isWordStart) continue;

      if (this.fuzzyMatchFrom(text, search, i + 1, searchIdx + 1, wordStarts, false)) {
        return true;
      }
    }

    return false;
  }
}
