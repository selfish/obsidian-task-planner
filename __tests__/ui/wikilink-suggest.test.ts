import { App, TFile } from "obsidian";

import { WikilinkSuggest } from "../../src/ui/wikilink-suggest";

describe("WikilinkSuggest", () => {
  it("uses Obsidian's canonical link text for the selected file", () => {
    const app = new App();
    const inputEl = document.createElement("div");
    inputEl.textContent = "[[Al";
    inputEl.createSpan = (() => {
      const span = document.createElement("span");
      inputEl.appendChild(span);
      return span;
    }) as typeof inputEl.createSpan;

    const onLinkInserted = jest.fn();
    const suggest = new WikilinkSuggest(app, inputEl, onLinkInserted, "Tasks/Inbox.md");
    const internals = suggest as unknown as {
      getCursorPosition: () => number;
      setCursorAfter: (element: HTMLElement) => void;
    };
    jest.spyOn(internals, "getCursorPosition").mockReturnValue(inputEl.textContent.length);
    jest.spyOn(internals, "setCursorAfter").mockImplementation(() => undefined);

    const file = new TFile("Projects/Alpha.md");
    app.metadataCache.fileToLinktext = jest.fn().mockReturnValue("Projects/Alpha");

    suggest.selectSuggestion(file, new MouseEvent("click"));

    expect(app.metadataCache.fileToLinktext).toHaveBeenCalledWith(file, "Tasks/Inbox.md", true);
    const link = inputEl.querySelector(".quick-add-wikilink") as HTMLSpanElement;
    expect(link.dataset.target).toBe("Projects/Alpha");
    expect(link.textContent).toBe("Alpha");
    expect(onLinkInserted).toHaveBeenCalledTimes(1);
  });
});
