import { AbstractInputSuggest, App, TFile } from "obsidian";

/**
 * Suggest class for wikilink completion in contenteditable elements.
 * Triggers when user types [[ and shows file suggestions.
 *
 * Note: This class relies heavily on browser Selection/Range APIs
 * which are not fully supported in jsdom, making it difficult to unit test.
 * It is excluded from coverage requirements.
 */
export class WikilinkSuggest extends AbstractInputSuggest<TFile> {
  private inputEl: HTMLDivElement;

  constructor(
    app: App,
    inputEl: HTMLDivElement,
    private onLinkInserted: () => void
  ) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(_query: string): TFile[] {
    const text = this.getTextContent();
    const cursorPos = this.getCursorPosition();
    const textBeforeCursor = text.slice(0, cursorPos);

    // Find the last [[ before cursor
    const linkStart = textBeforeCursor.lastIndexOf("[[");
    if (linkStart === -1) return [];

    const linkQuery = textBeforeCursor.slice(linkStart + 2).toLowerCase();
    if (linkQuery.includes("]]")) return [];

    const files = this.app.vault.getMarkdownFiles();
    return files.filter((file) => file.basename.toLowerCase().includes(linkQuery) || file.path.toLowerCase().includes(linkQuery)).slice(0, 20);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createDiv({ cls: "suggestion-title", text: file.basename });
    if (file.parent && file.parent.path !== "/") {
      el.createDiv({ cls: "suggestion-note", text: file.parent.path });
    }
  }

  selectSuggestion(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    const text = this.getTextContent();
    const cursorPos = this.getCursorPosition();
    const textBeforeCursor = text.slice(0, cursorPos);

    const linkStart = textBeforeCursor.lastIndexOf("[[");
    if (linkStart === -1) return;

    // Get text before the [[ and after cursor
    const before = text.slice(0, linkStart);
    const after = text.slice(cursorPos);

    // Create the wikilink span
    const linkSpan = this.inputEl.createSpan();
    linkSpan.className = "quick-add-wikilink";
    linkSpan.dataset.target = file.basename;
    linkSpan.textContent = file.basename;
    linkSpan.contentEditable = "false";

    // Rebuild the content
    this.inputEl.innerHTML = "";
    if (before) {
      this.inputEl.appendChild(this.inputEl.ownerDocument.createTextNode(before));
    }
    this.inputEl.appendChild(linkSpan);
    // Add a space after for easier continued typing
    const afterText = this.inputEl.ownerDocument.createTextNode(" " + after);
    this.inputEl.appendChild(afterText);

    // Move cursor after the link
    this.setCursorAfter(linkSpan);
    this.close();
    this.onLinkInserted();
  }

  private getTextContent(): string {
    return this.inputEl.textContent || "";
  }

  private getCursorPosition(): number {
    const selection = this.inputEl.ownerDocument.defaultView?.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    if (!this.inputEl.contains(range.startContainer)) return 0;

    const preRange = this.inputEl.ownerDocument.createRange();
    preRange.selectNodeContents(this.inputEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }

  private setCursorAfter(element: HTMLElement): void {
    const selection = this.inputEl.ownerDocument.defaultView?.getSelection();
    if (!selection) return;

    const range = this.inputEl.ownerDocument.createRange();
    if (element.nextSibling) {
      range.setStart(element.nextSibling, 1); // After the space
      range.collapse(true);
    } else {
      range.setStartAfter(element);
      range.collapse(true);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
