import { App, Modal, TFolder } from "obsidian";

import { addIgnoredFolder, editHorizon, editShortcut } from "../../src/settings/settings-editors";
import type { CustomHorizon, CustomAtShortcut } from "../../src/settings/types";

jest.mock("../../src/ui/folder-suggest", () => ({ FolderSuggest: jest.fn() }));
jest.mock("obsidian", () => {
  const base = jest.requireActual("../__mocks__/obsidian");
  class Setting {
    row: HTMLElement;
    constructor(container: HTMLElement) { this.row = document.createElement("div"); container.append(this.row); }
    setName(name: string) { this.row.setAttribute("aria-label", name); return this; }
    setDesc() { return this; }
    addSearch(callback: (field: unknown) => void) { return this.addText(callback); }
    addText(callback: (field: unknown) => void) {
      const input = document.createElement("input"); this.row.append(input);
      const field = { inputEl: input, setValue: (value: string) => { input.value = value; return field; }, setPlaceholder: () => field, onChange: (handler: (value: string) => void) => { input.oninput = () => handler(input.value); return field; } };
      callback(field); return this;
    }
    addDropdown(callback: (field: unknown) => void) {
      const input = document.createElement("select"); this.row.append(input);
      const field = { addOptions: (options: Record<string, string>) => { for (const [value, label] of Object.entries(options)) input.add(new Option(label, value)); return field; }, addOption: (value: string, label: string) => { input.add(new Option(label, value)); return field; }, setValue: (value: string) => { input.value = value; return field; }, onChange: (handler: (value: string) => void) => { input.onchange = () => handler(input.value); return field; } };
      callback(field); return this;
    }
    addButton(callback: (field: unknown) => void) {
      const button = document.createElement("button"); this.row.append(button);
      const field = { buttonEl: button, setButtonText: (value: string) => { button.textContent = value; return field; }, setCta: () => field, setDisabled: (value: boolean) => { button.disabled = value; return field; }, onClick: (handler: () => void) => { button.onclick = handler; return field; } };
      callback(field); return this;
    }
  }
  return { ...base, Setting };
});

function set(name: string, value: string) {
  const field = document.querySelector(`[aria-label="${name}"] input, [aria-label="${name}"] select`) as HTMLInputElement | HTMLSelectElement;
  field.value = value;
  field.dispatchEvent(new Event(field.tagName === "SELECT" ? "change" : "input"));
}
async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent === label)!;
  button.click();
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
const error = () => document.querySelector('[role="alert"]')?.textContent;

beforeAll(() => {
  HTMLElement.prototype.addClass = function (...names: string[]) { this.classList.add(...names); };
  HTMLElement.prototype.setText = function (text: string) { this.textContent = text; };
  HTMLElement.prototype.createDiv = function (this: HTMLElement, options?: { attr?: Record<string, string> }) {
    const div = document.createElement("div");
    for (const [name, value] of Object.entries(options?.attr ?? {})) div.setAttribute(name, value);
    this.append(div);
    return div;
  } as HTMLElement["createDiv"];
});

beforeEach(() => {
  document.body.replaceChildren();
  jest.spyOn(Modal.prototype, "open").mockImplementation(function (this: Modal) {
    document.body.append(this.contentEl);
    this.onOpen();
  });
});
afterEach(() => jest.restoreAllMocks());

it("keeps horizon edits in a private draft when cancelled", async () => {
  const original: CustomHorizon = { label: "Original", tag: "work", date: "2026-10-10", position: "end" };
  const snapshot = JSON.stringify(original);
  const save = jest.fn();
  editHorizon(new App(), original, save);
  set("Name", "Changed"); set("Tag", "new"); set("Date", "2026-12-20");
  await click("Cancel");
  expect(JSON.stringify(original)).toBe(snapshot);
  expect(save).not.toHaveBeenCalled();
});

it("validates horizon names, dates and single tags before committing", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  editHorizon(new App(), undefined, save);
  await click("Save"); expect(error()).toContain("name");
  set("Name", "Next launch"); set("Date", "2026-02-30");
  await click("Save"); expect(error()).toContain("valid date");
  set("Date", "2026-10-20"); set("Tag", "two tags");
  await click("Save"); expect(error()).toContain("one tag");
  set("Tag", "#launch"); set("Color", "purple"); set("Position", "inline");
  await click("Save");
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ label: "Next launch", tag: "launch", date: "2026-10-20", color: "purple", position: "inline" }));
});

it("retains draft input when persistence fails", async () => {
  const save = jest.fn().mockRejectedValue(new Error("Disk is full"));
  editHorizon(new App(), undefined, save);
  set("Name", "Backlog"); set("Date", "2026-10-10");
  await click("Save");
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-10-10" }));
  expect(error()).toContain("Your changes are still here");
  expect((document.querySelector('[aria-label="Name"] input') as HTMLInputElement).value).toBe("Backlog");
  expect([...document.querySelectorAll("button")].find((button) => button.textContent === "Save")?.disabled).toBe(false);
});

it("validates and saves only parser-supported shortcut keywords and attributes", async () => {
  const existing: CustomAtShortcut[] = [{ keyword: "work", targetAttribute: "context", value: "office" }];
  const save = jest.fn().mockResolvedValue(undefined);
  editShortcut(new App(), undefined, existing, save);
  await click("Save"); expect(error()).toContain("keyword");
  set("Keyword", "work"); set("Attribute", "context"); await click("Save"); expect(error()).toContain("already has");
  set("Keyword", "tomorrow"); await click("Save"); expect(error()).toContain("reserved");
  set("Keyword", "under-score"); await click("Save"); expect(error()).toContain("keyword");
  set("Keyword", "office"); set("Attribute", "bad attribute"); await click("Save"); expect(error()).toContain("attribute");
  set("Attribute", "context"); set("Value", "bad]value"); await click("Save"); expect(error()).toContain("brackets");
  set("Value", "office"); await click("Save");
  expect(save).toHaveBeenCalledWith({ keyword: "office", targetAttribute: "context", value: "office" });
});

it("allows editing an existing shortcut and converts literal true to a flag", async () => {
  const original: CustomAtShortcut = { keyword: "flag", targetAttribute: "selected", value: true };
  const save = jest.fn().mockResolvedValue(undefined);
  editShortcut(new App(), original, [original], save);
  await click("Save");
  expect(save).toHaveBeenCalledWith(original);
});

it("validates existing vault folders and prevents duplicate exclusions", async () => {
  const app = new App();
  const folder = new TFolder();
  app.vault.getAbstractFileByPath = jest.fn((path: string) => path === "Archive" || path === "AlreadyIgnored" ? folder : null);
  const save = jest.fn().mockResolvedValue(undefined);
  addIgnoredFolder(app, ["AlreadyIgnored"], save);
  await click("Save"); expect(error()).toContain("not the vault root");
  set("Folder", "Missing"); await click("Save"); expect(error()).toContain("existing folder");
  set("Folder", "AlreadyIgnored"); await click("Save"); expect(error()).toContain("already in the list");
  set("Folder", "Archive"); await click("Save");
  expect(save).toHaveBeenCalledWith("Archive");
});
