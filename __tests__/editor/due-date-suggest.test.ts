import { App, Editor, TFile } from "obsidian";
import { DueDateSuggest } from "../../src/editor/due-date-suggest";
import { DEFAULT_SETTINGS } from "../../src/settings";
import { DueDateEditor } from "../../src/ui/due-date-modal";

describe("native due date suggestion", () => {
  function hostElement<T extends HTMLElement>(element: T): T {
    Object.assign(element, {
      addClass: (name: string) => element.classList.add(name),
      createEl: (tag: string, options: any = {}) => {
        const child = hostElement(document.createElement(tag));
        if (options.text) child.textContent = options.text;
        if (options.cls) child.className = options.cls;
        if (options.type) child.setAttribute("type", options.type);
        for (const [name, value] of Object.entries(options.attr ?? {})) child.setAttribute(name, String(value));
        element.appendChild(child);
        return child;
      },
      createDiv: (options: any) => (element as any).createEl("div", options),
    });
    return element;
  }

  function setup(text = "- [ ] Task @date") {
    const config = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const apply = jest.fn();
    const start = jest.fn(() => ({ initialDate: undefined, apply }));
    const suggest = new DueDateSuggest(new App(), () => config, { start } as unknown as DueDateEditor);
    const editor = { getValue: () => text, getLine: () => text, getCursor: () => ({ line: 0, ch: text.length }), somethingSelected: () => false } as unknown as Editor;
    return { config, suggest, editor, start, apply };
  }

  it("offers one calendar action with exact source positions", () => {
    const { suggest, editor } = setup();
    const file = new TFile();
    const trigger = suggest.onTrigger({ line: 0, ch: 16 }, editor, file);
    expect(trigger).toEqual({ start: { line: 0, ch: 11 }, end: { line: 0, ch: 16 }, query: "date" });
    expect(suggest.getSuggestions()).toEqual(["date"]);
  });

  it("renders and submits the calendar in the existing suggestion popup", () => {
    const { suggest, editor, start, apply } = setup();
    suggest.selectSuggestion();
    expect(start).not.toHaveBeenCalled();
    const file = new TFile();
    suggest.context = { editor, file, start: { line: 0, ch: 11 }, end: { line: 0, ch: 16 }, query: "date" };
    const el = hostElement(document.createElement("div"));
    document.body.appendChild(el);
    suggest.renderSuggestion("date", el);
    expect(start).toHaveBeenCalledWith(editor, file, 11);
    const input = el.querySelector("input")!;
    expect(input.type).toBe("date");
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    input.value = "2026-12-25";
    suggest.selectSuggestion();
    expect(document.activeElement).toBe(input);
    el.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(suggest.close).toHaveBeenCalled();
    expect(apply).toHaveBeenCalledWith("2026-12-25");
  });

  it("cancels without applying and removes only an existing date", () => {
    const { suggest, editor, start, apply } = setup();
    start.mockReturnValue({ initialDate: "2026-09-17", apply });
    const file = new TFile();
    suggest.context = { editor, file, start: { line: 0, ch: 11 }, end: { line: 0, ch: 16 }, query: "date" };
    const cancel = hostElement(document.createElement("div"));
    suggest.renderSuggestion("date", cancel);
    [...cancel.querySelectorAll("button")].find((button) => button.textContent === "Cancel")!.click();
    expect(apply).not.toHaveBeenCalled();
    const remove = hostElement(document.createElement("div"));
    suggest.renderSuggestion("date", remove);
    [...remove.querySelectorAll("button")].find((button) => button.textContent === "Remove date")!.click();
    expect(apply).toHaveBeenCalledWith(null);
  });

  it("does not hijack disabled shortcuts, ordinary text, or editors without a file", () => {
    const { config, suggest, editor } = setup();
    expect(suggest.onTrigger({ line: 0, ch: 16 }, editor, null)).toBeNull();
    config.atShortcutSettings.enableAtShortcuts = false;
    expect(suggest.onTrigger({ line: 0, ch: 16 }, editor, new TFile())).toBeNull();
    const plain = setup("ordinary @date");
    expect(plain.suggest.onTrigger({ line: 0, ch: 14 }, plain.editor, new TFile())).toBeNull();
  });
});
