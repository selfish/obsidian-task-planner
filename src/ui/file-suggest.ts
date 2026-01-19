import { App, TFile } from "obsidian";

import { TextInputSuggest } from "./text-input-suggest";

export class FileSuggest extends TextInputSuggest<TFile> {
  constructor(inputEl: HTMLInputElement, app: App) {
    super(inputEl, app);
  }

  getSuggestions(inputStr: string): TFile[] {
    const files = this.app.vault.getMarkdownFiles();
    const lowerCaseInputStr = inputStr.toLowerCase();

    return files.filter((file) => file.path.toLowerCase().contains(lowerCaseInputStr));
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.inputEl.value = file.path;
    this.inputEl.trigger("input");
    this.close();
  }
}
