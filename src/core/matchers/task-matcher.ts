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
    // Escape special regex characters and preserve spaces for exact matching
    const escapedTerm = matchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    this.regex = RegExp(escapedTerm, "gi");
  }

  public matches(task: TaskItem<T>): boolean {
    if (!this.matchTerm) {
      return true;
    }
    if (this.fuzzySearch) {
      return this.fuzzyMatch(task);
    } else {
      return this.exactMatch(task);
    }
  }

  private exactMatch(task: TaskItem<T>) {
    return task.text.search(this.regex) >= 0;
  }

  /**
   * Fuzzy match that requires characters to appear at word boundaries or consecutively.
   * This prevents overly loose matches while still allowing useful patterns like:
   * - "nst" matches "Next Staff Talk" (word initials)
   * - "staff" matches "Staff Talk" (substring)
   * - "nexsta" matches "Next Staff" (consecutive + word start)
   */
  private fuzzyMatch(task: TaskItem<T>): boolean {
    const taskText = task.text.toLowerCase();
    const searchChars = this.matchTerm.replace(/\s/g, ""); // Remove spaces from search

    if (searchChars.length === 0) return true;

    // Find word boundaries (start of string or after non-alphanumeric)
    const wordStarts = new Set<number>();
    wordStarts.add(0);
    for (let i = 1; i < taskText.length; i++) {
      const prevChar = taskText[i - 1];
      if (!/[a-z0-9]/.test(prevChar)) {
        wordStarts.add(i);
      }
    }

    // Try to match using recursive backtracking with constraints
    return this.fuzzyMatchFrom(taskText, searchChars, 0, 0, wordStarts, true);
  }

  /**
   * Recursive fuzzy matcher with constraints:
   * - First character of search must match at a word boundary
   * - Subsequent characters must either be consecutive OR at a word boundary
   */
  private fuzzyMatchFrom(text: string, search: string, textIdx: number, searchIdx: number, wordStarts: Set<number>, mustBeWordStart: boolean): boolean {
    // All search characters matched
    if (searchIdx >= search.length) return true;

    // No more text to search
    if (textIdx >= text.length) return false;

    const searchChar = search[searchIdx];

    // Try each position from textIdx onwards
    for (let i = textIdx; i < text.length; i++) {
      if (text[i] !== searchChar) continue;

      const isWordStart = wordStarts.has(i);
      const isConsecutive = i === textIdx;

      // First search char must be at word start, others can be consecutive or word start
      if (mustBeWordStart && !isWordStart) continue;
      if (!mustBeWordStart && !isConsecutive && !isWordStart) continue;

      // Try matching rest of search from next position
      // Next char can be consecutive (i+1) or must be at word boundary
      if (this.fuzzyMatchFrom(text, search, i + 1, searchIdx + 1, wordStarts, false)) {
        return true;
      }
    }

    return false;
  }
}
