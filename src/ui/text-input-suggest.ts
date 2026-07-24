import { AbstractInputSuggest, App } from "obsidian";

const HostInputSuggest: typeof AbstractInputSuggest | undefined = AbstractInputSuggest;

// ponytail: Obsidian <1.4.10 has no public input-suggest API; keep inputs usable there without type-ahead.
export const CompatibleInputSuggest = (HostInputSuggest ??
  class {
    constructor(protected app: App) {}
    open(): void {}
    close(): void {}
  }) as typeof AbstractInputSuggest;

export abstract class TextInputSuggest<T> extends CompatibleInputSuggest<T> {
  protected inputEl: HTMLInputElement;

  constructor(inputEl: HTMLInputElement, app: App) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  abstract getSuggestions(inputStr: string): T[];
  abstract renderSuggestion(item: T, el: HTMLElement): void;
  abstract selectSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;
}
