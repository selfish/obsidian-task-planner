import { AbstractInputSuggest, App } from "obsidian";

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
