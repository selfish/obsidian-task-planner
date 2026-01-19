import { App, TFile } from "obsidian";

import { FileSuggest } from "../../src/ui/file-suggest";

describe("FileSuggest", () => {
  let mockApp: App;
  let mockInputEl: HTMLInputElement;
  let fileSuggest: FileSuggest;

  beforeEach(() => {
    mockApp = new App();
    mockInputEl = document.createElement("input");
    mockInputEl.trigger = jest.fn();
    fileSuggest = new FileSuggest(mockInputEl, mockApp);
  });

  describe("constructor", () => {
    it("should create an instance", () => {
      expect(fileSuggest).toBeInstanceOf(FileSuggest);
    });

    it("should store the input element", () => {
      expect((fileSuggest as unknown as { inputEl: HTMLInputElement }).inputEl).toBe(mockInputEl);
    });

    it("should store the app reference", () => {
      expect((fileSuggest as unknown as { app: App }).app).toBe(mockApp);
    });
  });

  describe("getSuggestions", () => {
    it("should return files matching the input string", () => {
      const file1 = new TFile("notes.md");
      const file2 = new TFile("notes/daily.md");
      const file3 = new TFile("archive.md");

      mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue([file1, file2, file3]);

      const results = fileSuggest.getSuggestions("notes");

      expect(results).toHaveLength(2);
      expect(results).toContain(file1);
      expect(results).toContain(file2);
      expect(results).not.toContain(file3);
    });

    it("should be case-insensitive", () => {
      const file = new TFile("Notes.md");

      mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue([file]);

      const results = fileSuggest.getSuggestions("NOTES");

      expect(results).toHaveLength(1);
      expect(results).toContain(file);
    });

    it("should return empty array when no matches", () => {
      const file = new TFile("documents.md");

      mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue([file]);

      const results = fileSuggest.getSuggestions("notes");

      expect(results).toHaveLength(0);
    });

    it("should return all files for empty input", () => {
      const file1 = new TFile("notes.md");
      const file2 = new TFile("archive.md");

      mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue([file1, file2]);

      const results = fileSuggest.getSuggestions("");

      expect(results).toHaveLength(2);
    });

    it("should match partial paths", () => {
      const file = new TFile("documents/projects/2024/report.md");

      mockApp.vault.getMarkdownFiles = jest.fn().mockReturnValue([file]);

      const results = fileSuggest.getSuggestions("proj");

      expect(results).toHaveLength(1);
      expect(results).toContain(file);
    });
  });

  describe("renderSuggestion", () => {
    it("should set the element text to file path", () => {
      const file = new TFile("notes/daily.md");
      const el = document.createElement("div");
      el.setText = jest.fn();

      fileSuggest.renderSuggestion(file, el);

      expect(el.setText).toHaveBeenCalledWith("notes/daily.md");
    });
  });

  describe("selectSuggestion", () => {
    it("should set input value to file path", () => {
      const file = new TFile("notes/daily.md");

      fileSuggest.selectSuggestion(file, new MouseEvent("click"));

      expect(mockInputEl.value).toBe("notes/daily.md");
    });

    it("should trigger input event", () => {
      const file = new TFile("notes.md");

      fileSuggest.selectSuggestion(file, new MouseEvent("click"));

      expect(mockInputEl.trigger).toHaveBeenCalledWith("input");
    });

    it("should close the suggestion popup", () => {
      const file = new TFile("notes.md");
      const closeSpy = jest.spyOn(fileSuggest, "close");

      fileSuggest.selectSuggestion(file, new MouseEvent("click"));

      expect(closeSpy).toHaveBeenCalled();
    });

    it("should work with keyboard events", () => {
      const file = new TFile("archive.md");

      fileSuggest.selectSuggestion(file, new KeyboardEvent("keydown"));

      expect(mockInputEl.value).toBe("archive.md");
      expect(mockInputEl.trigger).toHaveBeenCalledWith("input");
    });
  });
});
