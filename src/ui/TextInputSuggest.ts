import { AbstractInputSuggest, App } from "obsidian";

/**
 * Base class for input suggestions using Obsidian's built-in AbstractInputSuggest.
 * Provides type-safe autocomplete functionality for input elements.
 */
export abstract class TextInputSuggest<T> extends AbstractInputSuggest<T> {
  protected inputEl: HTMLInputElement;

  constructor(inputEl: HTMLInputElement, app: App) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  abstract getSuggestions(inputStr: string): T[];
  abstract renderSuggestion(item: T, el: HTMLElement): void;
  abstract selectSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;
}
