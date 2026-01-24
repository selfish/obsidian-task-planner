import { App, TFile, MetadataCache, FileManager } from 'obsidian';
import { cleanFileName, getFileDisplayName, setFrontmatterProperty, removeFrontmatterProperty } from '../../src/utils/file-utils';

describe('cleanFileName', () => {
  it('should remove .md extension', () => {
    expect(cleanFileName('document.md')).toBe('document');
  });

  it('should remove leading numbers and dashes', () => {
    expect(cleanFileName('2024-01-15 Meeting Notes.md')).toBe('Meeting Notes');
  });

  it('should remove leading numbers only', () => {
    expect(cleanFileName('123 Document.md')).toBe('Document');
  });

  it('should remove leading dashes and spaces', () => {
    expect(cleanFileName('--- Important.md')).toBe('Important');
  });

  it('should handle mixed leading characters', () => {
    expect(cleanFileName('2024-01-15-daily-note.md')).toBe('daily-note');
  });

  it('should preserve internal numbers', () => {
    expect(cleanFileName('Chapter 5 Notes.md')).toBe('Chapter 5 Notes');
  });

  it('should return original name (minus extension) if cleaning results in empty string', () => {
    expect(cleanFileName('2024-01-15.md')).toBe('2024-01-15');
  });

  it('should handle files without .md extension', () => {
    expect(cleanFileName('document')).toBe('document');
  });

  it('should handle already clean names', () => {
    expect(cleanFileName('Clean Name.md')).toBe('Clean Name');
  });

  it('should trim whitespace', () => {
    expect(cleanFileName('2024   Document.md')).toBe('Document');
  });

  it('should handle names with only numbers', () => {
    expect(cleanFileName('12345.md')).toBe('12345');
  });

  it('should handle empty string prefix result', () => {
    expect(cleanFileName('----.md')).toBe('----');
  });

  it('should handle complex date prefixes', () => {
    expect(cleanFileName('2024-12-31 - Year End Review.md')).toBe('Year End Review');
  });
});

describe('getFileDisplayName', () => {
  const createMockApp = (frontmatterTitle?: string | number | null): App => {
    const mockCache: MetadataCache = {
      getFileCache: jest.fn().mockReturnValue(
        frontmatterTitle !== undefined
          ? { frontmatter: { title: frontmatterTitle } }
          : null
      ),
      getCache: jest.fn(),
      getFirstLinkpathDest: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      trigger: jest.fn(),
    } as unknown as MetadataCache;

    return {
      metadataCache: mockCache,
      vault: {},
      workspace: {},
    } as unknown as App;
  };

  const createMockFile = (name: string, path?: string): TFile => {
    return {
      name,
      path: path || name,
      basename: name.replace(/\.md$/, ''),
      extension: 'md',
      vault: {},
      parent: null,
      stat: { ctime: Date.now(), mtime: Date.now(), size: 0 },
    } as TFile;
  };

  it('should return frontmatter title when available', () => {
    const app = createMockApp('My Custom Title');
    const file = createMockFile('2024-01-15 Note.md');

    expect(getFileDisplayName(file, app)).toBe('My Custom Title');
  });

  it('should fall back to cleaned filename when no frontmatter', () => {
    const app = createMockApp(undefined);
    const file = createMockFile('2024-01-15 Meeting Notes.md');

    expect(getFileDisplayName(file, app)).toBe('Meeting Notes');
  });

  it('should fall back to cleaned filename when frontmatter is null', () => {
    const app = createMockApp(null);
    const file = createMockFile('2024-01-15 Document.md');

    expect(getFileDisplayName(file, app)).toBe('Document');
  });

  it('should fall back to cleaned filename when title is not a string', () => {
    const app = createMockApp(123);
    const file = createMockFile('2024-01-15 Notes.md');

    expect(getFileDisplayName(file, app)).toBe('Notes');
  });

  it('should handle empty frontmatter title', () => {
    const app = createMockApp('');
    const file = createMockFile('2024-01-15 Document.md');

    // Empty string is falsy, should fall back
    expect(getFileDisplayName(file, app)).toBe('Document');
  });

  it('should use file cache correctly', () => {
    const app = createMockApp('Title');
    const file = createMockFile('test.md');

    getFileDisplayName(file, app);

    expect(app.metadataCache.getFileCache).toHaveBeenCalledWith(file);
  });

  it('should handle files without date prefix', () => {
    const app = createMockApp(undefined);
    const file = createMockFile('Regular Document.md');

    expect(getFileDisplayName(file, app)).toBe('Regular Document');
  });

  it('should handle deeply nested files', () => {
    const app = createMockApp(undefined);
    const file = createMockFile('note.md', 'folder/subfolder/note.md');

    expect(getFileDisplayName(file, app)).toBe('note');
  });
});

describe('setFrontmatterProperty', () => {
  const createMockFile = (name: string): TFile => {
    return {
      name,
      path: name,
      basename: name.replace(/\.md$/, ''),
      extension: 'md',
      vault: {},
      parent: null,
      stat: { ctime: Date.now(), mtime: Date.now(), size: 0 },
    } as TFile;
  };

  it('should call processFrontMatter with the correct key and value', async () => {
    const processFrontMatter = jest.fn().mockImplementation((_file, callback) => {
      const frontmatter: Record<string, unknown> = {};
      callback(frontmatter);
      expect(frontmatter['my-key']).toBe('my-value');
      return Promise.resolve();
    });

    const app = {
      fileManager: { processFrontMatter } as unknown as FileManager,
    } as unknown as App;

    const file = createMockFile('test.md');
    await setFrontmatterProperty(app, file, 'my-key', 'my-value');

    expect(processFrontMatter).toHaveBeenCalledWith(file, expect.any(Function));
  });

  it('should handle boolean values', async () => {
    const processFrontMatter = jest.fn().mockImplementation((_file, callback) => {
      const frontmatter: Record<string, unknown> = {};
      callback(frontmatter);
      expect(frontmatter['task-planner-ignore']).toBe(true);
      return Promise.resolve();
    });

    const app = {
      fileManager: { processFrontMatter } as unknown as FileManager,
    } as unknown as App;

    const file = createMockFile('test.md');
    await setFrontmatterProperty(app, file, 'task-planner-ignore', true);

    expect(processFrontMatter).toHaveBeenCalled();
  });
});

describe('removeFrontmatterProperty', () => {
  const createMockFile = (name: string): TFile => {
    return {
      name,
      path: name,
      basename: name.replace(/\.md$/, ''),
      extension: 'md',
      vault: {},
      parent: null,
      stat: { ctime: Date.now(), mtime: Date.now(), size: 0 },
    } as TFile;
  };

  it('should delete the specified key from frontmatter', async () => {
    const processFrontMatter = jest.fn().mockImplementation((_file, callback) => {
      const frontmatter: Record<string, unknown> = { 'existing-key': 'value', 'key-to-remove': 'bye' };
      callback(frontmatter);
      expect(frontmatter['key-to-remove']).toBeUndefined();
      expect(frontmatter['existing-key']).toBe('value');
      return Promise.resolve();
    });

    const app = {
      fileManager: { processFrontMatter } as unknown as FileManager,
    } as unknown as App;

    const file = createMockFile('test.md');
    await removeFrontmatterProperty(app, file, 'key-to-remove');

    expect(processFrontMatter).toHaveBeenCalledWith(file, expect.any(Function));
  });
});
