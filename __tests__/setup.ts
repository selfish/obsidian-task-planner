import "@testing-library/jest-dom";

declare global {
  interface String {
    contains(searchString: string): boolean;
  }
  interface HTMLElement {
    setText(text: string): void;
  }
  interface HTMLInputElement {
    trigger(eventType: string): void;
  }
}

String.prototype.contains = function (searchString: string): boolean {
  return this.includes(searchString);
};

HTMLElement.prototype.setText = function (text: string): void {
  this.textContent = text;
};

HTMLInputElement.prototype.trigger = function (eventType: string): void {
  this.dispatchEvent(new Event(eventType, { bubbles: true }));
};

beforeEach(() => {
  jest.clearAllMocks();
});

export type ObsidianExtendedElement = HTMLElement & {
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  createDiv: (options?: { cls?: string; text?: string; attr?: Record<string, string> }) => ObsidianExtendedElement;
  createEl: (tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) => ObsidianExtendedElement;
  createSpan: (options?: { cls?: string; text?: string }) => ObsidianExtendedElement;
  empty: () => void;
  setText: (text: string) => void;
};

export function addObsidianExtensions(el: HTMLElement): ObsidianExtendedElement {
  const extEl = el as ObsidianExtendedElement;
  extEl.addClass = function (cls: string) {
    this.classList.add(cls);
  };
  extEl.removeClass = function (cls: string) {
    this.classList.remove(cls);
  };
  extEl.empty = function () {
    while (this.firstChild) this.removeChild(this.firstChild);
  };
  extEl.setText = function (text: string) {
    this.textContent = text;
  };
  extEl.createDiv = function (options?) {
    const div = document.createElement("div");
    addObsidianExtensions(div);
    if (options?.cls) div.className = options.cls;
    if (options?.text) div.textContent = options.text;
    if (options?.attr) Object.entries(options.attr).forEach(([k, v]) => div.setAttribute(k, v));
    this.appendChild(div);
    return div as ObsidianExtendedElement;
  };
  extEl.createEl = function (tag: string, options?) {
    const element = document.createElement(tag);
    addObsidianExtensions(element);
    if (options?.cls) element.className = options.cls;
    if (options?.text) element.textContent = options.text;
    if (options?.attr) Object.entries(options.attr).forEach(([k, v]) => element.setAttribute(k, v));
    this.appendChild(element);
    return element as ObsidianExtendedElement;
  };
  extEl.createSpan = function (options?) {
    const span = document.createElement("span");
    addObsidianExtensions(span);
    if (options?.cls) span.className = options.cls;
    if (options?.text) span.textContent = options.text;
    this.appendChild(span);
    return span as ObsidianExtendedElement;
  };
  return extEl;
}
