// noinspection JSUnusedGlobalSymbols

// Mock TFile
export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  vault: Vault;
  parent: TFolder | null;
  stat: { ctime: number; mtime: number; size: number };

  constructor(path: string = 'test.md') {
    this.path = path;
    this.name = path.split('/').pop() || path;
    this.basename = this.name.replace(/\.[^.]+$/, '');
    this.extension = this.name.split('.').pop() || '';
    this.vault = new Vault();
    this.parent = null;
    this.stat = { ctime: Date.now(), mtime: Date.now(), size: 0 };
  }
}

// Mock TFolder
export class TFolder {
  path: string;
  name: string;
  vault: Vault;
  parent: TFolder | null;
  children: (TFile | TFolder)[];

  constructor(path: string = '') {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.vault = new Vault();
    this.parent = null;
    this.children = [];
  }
}

// Mock TAbstractFile
export class TAbstractFile {
  path: string;
  name: string;
  vault: Vault;
  parent: TFolder | null;

  constructor(path: string = '') {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.vault = new Vault();
    this.parent = null;
  }
}

// Mock Vault
export class Vault {
  adapter: any;
  configDir: string;

  constructor() {
    this.adapter = {
      read: jest.fn().mockResolvedValue(''),
      write: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      stat: jest.fn().mockResolvedValue({ ctime: Date.now(), mtime: Date.now(), size: 0 }),
      list: jest.fn().mockResolvedValue({ files: [], folders: [] }),
      mkdir: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      rename: jest.fn().mockResolvedValue(undefined),
    };
    this.configDir = '.obsidian';
  }

  read = jest.fn().mockResolvedValue('');
  cachedRead = jest.fn().mockResolvedValue('');
  create = jest.fn().mockResolvedValue(new TFile());
  createBinary = jest.fn().mockResolvedValue(new TFile());
  createFolder = jest.fn().mockResolvedValue(undefined);
  modify = jest.fn().mockResolvedValue(undefined);
  modifyBinary = jest.fn().mockResolvedValue(undefined);
  delete = jest.fn().mockResolvedValue(undefined);
  rename = jest.fn().mockResolvedValue(undefined);
  copy = jest.fn().mockResolvedValue(new TFile());
  getAbstractFileByPath = jest.fn().mockReturnValue(null);
  getRoot = jest.fn().mockReturnValue(new TFolder());
  getAllLoadedFiles = jest.fn().mockReturnValue([]);
  getMarkdownFiles = jest.fn().mockReturnValue([]);
  getFiles = jest.fn().mockReturnValue([]);
  on = jest.fn().mockReturnValue({ unload: jest.fn() });
  off = jest.fn();
  trigger = jest.fn();
}

// Mock Workspace
export class Workspace {
  leftSplit: any;
  rightSplit: any;
  leftRibbon: any;
  rightRibbon: any;
  rootSplit: any;
  activeLeaf: WorkspaceLeaf | null;

  constructor() {
    this.leftSplit = null;
    this.rightSplit = null;
    this.leftRibbon = null;
    this.rightRibbon = null;
    this.rootSplit = null;
    this.activeLeaf = null;
  }

  getLeaf = jest.fn().mockReturnValue(new WorkspaceLeaf());
  getActiveViewOfType = jest.fn().mockReturnValue(null);
  getActiveFile = jest.fn().mockReturnValue(null);
  getLeavesOfType = jest.fn().mockReturnValue([]);
  revealLeaf = jest.fn();
  setActiveLeaf = jest.fn();
  openLinkText = jest.fn().mockResolvedValue(undefined);
  on = jest.fn().mockReturnValue({ unload: jest.fn() });
  off = jest.fn();
  trigger = jest.fn();
}

// Mock WorkspaceLeaf
export class WorkspaceLeaf {
  view: any;

  constructor() {
    this.view = null;
  }

  getViewState = jest.fn().mockReturnValue({});
  setViewState = jest.fn().mockResolvedValue(undefined);
  open = jest.fn().mockResolvedValue(undefined);
  openFile = jest.fn().mockResolvedValue(undefined);
  detach = jest.fn();
}

// Mock App
export class App {
  vault: Vault;
  workspace: Workspace;
  metadataCache: MetadataCache;

  constructor() {
    this.vault = new Vault();
    this.workspace = new Workspace();
    this.metadataCache = new MetadataCache();
  }
}

// Mock MetadataCache
export class MetadataCache {
  getFileCache = jest.fn().mockReturnValue(null);
  getCache = jest.fn().mockReturnValue(null);
  getFirstLinkpathDest = jest.fn().mockReturnValue(null);
  on = jest.fn().mockReturnValue({ unload: jest.fn() });
  off = jest.fn();
  trigger = jest.fn();
}

// Mock Plugin
export class Plugin {
  app: App;
  manifest: PluginManifest;

  constructor(app: App, manifest: PluginManifest) {
    this.app = app;
    this.manifest = manifest;
  }

  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
  addRibbonIcon = jest.fn().mockReturnValue(document.createElement('div'));
  addStatusBarItem = jest.fn().mockReturnValue(document.createElement('div'));
  addCommand = jest.fn();
  addSettingTab = jest.fn();
  registerView = jest.fn();
  registerExtensions = jest.fn();
  registerMarkdownPostProcessor = jest.fn();
  registerMarkdownCodeBlockProcessor = jest.fn();
  registerCodeMirror = jest.fn();
  registerEditorExtension = jest.fn();
  registerEvent = jest.fn();
  registerDomEvent = jest.fn();
  registerInterval = jest.fn().mockReturnValue(0);
}

// Mock PluginManifest
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl?: string;
  isDesktopOnly?: boolean;
}

// Mock PluginSettingTab
export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
  hide(): void {}
}

// Mock Setting
export class Setting {
  settingEl: HTMLElement;
  infoEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.settingEl = document.createElement('div');
    this.infoEl = document.createElement('div');
    this.nameEl = document.createElement('div');
    this.descEl = document.createElement('div');
    this.controlEl = document.createElement('div');
    containerEl.appendChild(this.settingEl);
  }

  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  setClass = jest.fn().mockReturnThis();
  setTooltip = jest.fn().mockReturnThis();
  setHeading = jest.fn().mockReturnThis();
  setDisabled = jest.fn().mockReturnThis();
  addButton = jest.fn().mockReturnThis();
  addExtraButton = jest.fn().mockReturnThis();
  addToggle = jest.fn().mockReturnThis();
  addText = jest.fn().mockReturnThis();
  addTextArea = jest.fn().mockReturnThis();
  addMomentFormat = jest.fn().mockReturnThis();
  addDropdown = jest.fn().mockReturnThis();
  addColorPicker = jest.fn().mockReturnThis();
  addSlider = jest.fn().mockReturnThis();
  addSearch = jest.fn().mockReturnThis();
  then = jest.fn().mockReturnThis();
}

// Mock ItemView
export class ItemView {
  app: App;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  icon: string;

  constructor(leaf: WorkspaceLeaf) {
    this.app = new App();
    this.leaf = leaf;
    this.containerEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.containerEl.appendChild(this.contentEl);
    this.icon = 'document';
  }

  getViewType(): string {
    return 'item-view';
  }

  getDisplayText(): string {
    return 'Item View';
  }

  getIcon(): string {
    return this.icon;
  }

  onOpen(): Promise<void> {
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }
}

// Mock MarkdownView
export class MarkdownView extends ItemView {
  editor: any;
  file: TFile | null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.editor = {
      getLine: jest.fn().mockReturnValue(''),
      setLine: jest.fn(),
      getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
      setCursor: jest.fn(),
      getSelection: jest.fn().mockReturnValue(''),
      replaceSelection: jest.fn(),
      replaceRange: jest.fn(),
      getValue: jest.fn().mockReturnValue(''),
      setValue: jest.fn(),
      lineCount: jest.fn().mockReturnValue(1),
    };
    this.file = null;
  }

  getViewType(): string {
    return 'markdown';
  }
}

// Mock Modal
export class Modal {
  app: App;
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  modalEl: HTMLElement;
  titleEl: HTMLElement;

  constructor(app: App) {
    this.app = app;
    this.containerEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.modalEl = document.createElement('div');
    this.titleEl = document.createElement('div');
  }

  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

// Mock Notice
export class Notice {
  noticeEl: HTMLElement;

  constructor(_message: string | DocumentFragment, _timeout?: number) {
    this.noticeEl = document.createElement('div');
  }

  hide(): void {}
  setMessage(_message: string | DocumentFragment): this {
    return this;
  }
}

// Mock Menu
export class Menu {
  constructor() {}

  addItem = jest.fn().mockReturnThis();
  addSeparator = jest.fn().mockReturnThis();
  showAtPosition = jest.fn().mockReturnThis();
  showAtMouseEvent = jest.fn().mockReturnThis();
  hide = jest.fn().mockReturnThis();
  close = jest.fn();
}

// Mock MenuItem
export class MenuItem {
  setTitle = jest.fn().mockReturnThis();
  setIcon = jest.fn().mockReturnThis();
  setChecked = jest.fn().mockReturnThis();
  setDisabled = jest.fn().mockReturnThis();
  onClick = jest.fn().mockReturnThis();
  setSection = jest.fn().mockReturnThis();
}

// Mock Events
export class Events {
  on = jest.fn().mockReturnValue({ unload: jest.fn() });
  off = jest.fn();
  trigger = jest.fn();
  tryTrigger = jest.fn();
}

// Mock Component
export class Component {
  load = jest.fn();
  onload = jest.fn();
  unload = jest.fn();
  onunload = jest.fn();
  addChild = jest.fn();
  removeChild = jest.fn();
  register = jest.fn();
  registerEvent = jest.fn();
  registerDomEvent = jest.fn();
  registerInterval = jest.fn().mockReturnValue(0);
}

// Utility functions
export function setIcon(_el: HTMLElement, _iconId: string): void {}
export function setTooltip(_el: HTMLElement, _tooltip: string): void {}
export function addIcon(_iconId: string, _svgContent: string): void {}
export function removeIcon(_iconId: string): void {}

// Platform detection
export const Platform = {
  isDesktop: true,
  isDesktopApp: true,
  isMobile: false,
  isMobileApp: false,
  isIosApp: false,
  isAndroidApp: false,
  isMacOS: true,
  isWin: false,
  isLinux: false,
  isSafari: false,
};

// Keymap
export const Keymap = {
  isModEvent: jest.fn().mockReturnValue(false),
  isModifier: jest.fn().mockReturnValue(false),
};

// Re-export moment from the moment package
import momentLib from "moment";
export const moment = momentLib;

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  _immediate?: boolean
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const debouncedFn = ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T & { cancel: () => void };
  debouncedFn.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
  return debouncedFn;
}

// Normalization utilities
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function getLinkpath(linkText: string): string {
  return linkText.replace(/[#^|].*$/, '');
}

// Mock request functions
export const request = jest.fn().mockResolvedValue('');
export const requestUrl = jest.fn().mockResolvedValue({ text: '', json: {} });
