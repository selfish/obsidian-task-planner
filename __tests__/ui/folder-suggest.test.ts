import { App, TFolder, TFile, TAbstractFile } from 'obsidian';
import { FolderSuggest } from '../../src/ui/folder-suggest';

describe('FolderSuggest', () => {
  let mockApp: App;
  let mockInputEl: HTMLInputElement;
  let folderSuggest: FolderSuggest;

  beforeEach(() => {
    mockApp = new App();
    mockInputEl = document.createElement('input');
    mockInputEl.trigger = jest.fn();
    folderSuggest = new FolderSuggest(mockInputEl, mockApp);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(folderSuggest).toBeInstanceOf(FolderSuggest);
    });

    it('should store the input element', () => {
      expect((folderSuggest as any).inputEl).toBe(mockInputEl);
    });

    it('should store the app reference', () => {
      expect((folderSuggest as any).app).toBe(mockApp);
    });
  });

  describe('getSuggestions', () => {
    it('should return folders matching the input string', () => {
      const folder1 = new TFolder('notes');
      const folder2 = new TFolder('notes/daily');
      const folder3 = new TFolder('archive');
      const file1 = new TFile('test.md');

      mockApp.vault.getAllLoadedFiles = jest.fn().mockReturnValue([
        folder1,
        folder2,
        folder3,
        file1,
      ]);

      const results = folderSuggest.getSuggestions('notes');

      expect(results).toHaveLength(2);
      expect(results).toContain(folder1);
      expect(results).toContain(folder2);
      expect(results).not.toContain(folder3);
      expect(results).not.toContain(file1);
    });

    it('should be case-insensitive', () => {
      const folder = new TFolder('Notes');

      mockApp.vault.getAllLoadedFiles = jest.fn().mockReturnValue([folder]);

      const results = folderSuggest.getSuggestions('NOTES');

      expect(results).toHaveLength(1);
      expect(results).toContain(folder);
    });

    it('should return empty array when no matches', () => {
      const folder = new TFolder('documents');

      mockApp.vault.getAllLoadedFiles = jest.fn().mockReturnValue([folder]);

      const results = folderSuggest.getSuggestions('notes');

      expect(results).toHaveLength(0);
    });

    it('should return all folders for empty input', () => {
      const folder1 = new TFolder('notes');
      const folder2 = new TFolder('archive');

      mockApp.vault.getAllLoadedFiles = jest.fn().mockReturnValue([folder1, folder2]);

      const results = folderSuggest.getSuggestions('');

      expect(results).toHaveLength(2);
    });

    it('should only return TFolder instances', () => {
      const folder = new TFolder('notes');
      const file = new TFile('notes.md');
      const abstractFile = new TAbstractFile('notes/file');

      mockApp.vault.getAllLoadedFiles = jest.fn().mockReturnValue([
        folder,
        file,
        abstractFile,
      ]);

      const results = folderSuggest.getSuggestions('notes');

      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(TFolder);
    });

    it('should match partial paths', () => {
      const folder = new TFolder('documents/projects/2024');

      mockApp.vault.getAllLoadedFiles = jest.fn().mockReturnValue([folder]);

      const results = folderSuggest.getSuggestions('proj');

      expect(results).toHaveLength(1);
      expect(results).toContain(folder);
    });
  });

  describe('renderSuggestion', () => {
    it('should set the element text to folder path', () => {
      const folder = new TFolder('notes/daily');
      const el = document.createElement('div');
      el.setText = jest.fn();

      folderSuggest.renderSuggestion(folder, el);

      expect(el.setText).toHaveBeenCalledWith('notes/daily');
    });

    it('should handle root folder', () => {
      const folder = new TFolder('');
      const el = document.createElement('div');
      el.setText = jest.fn();

      folderSuggest.renderSuggestion(folder, el);

      expect(el.setText).toHaveBeenCalledWith('');
    });
  });

  describe('selectSuggestion', () => {
    it('should set input value to folder path', () => {
      const folder = new TFolder('notes/daily');

      folderSuggest.selectSuggestion(folder, new MouseEvent('click'));

      expect(mockInputEl.value).toBe('notes/daily');
    });

    it('should trigger input event', () => {
      const folder = new TFolder('notes');

      folderSuggest.selectSuggestion(folder, new MouseEvent('click'));

      expect(mockInputEl.trigger).toHaveBeenCalledWith('input');
    });

    it('should close the suggestion popup', () => {
      const folder = new TFolder('notes');
      const closeSpy = jest.spyOn(folderSuggest, 'close');

      folderSuggest.selectSuggestion(folder, new MouseEvent('click'));

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should work with keyboard events', () => {
      const folder = new TFolder('archive');

      folderSuggest.selectSuggestion(folder, new KeyboardEvent('keydown'));

      expect(mockInputEl.value).toBe('archive');
      expect(mockInputEl.trigger).toHaveBeenCalledWith('input');
    });
  });
});
