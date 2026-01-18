import '@testing-library/jest-dom';

// Add Obsidian's String.contains extension
declare global {
  interface String {
    contains(searchString: string): boolean;
  }
}

String.prototype.contains = function(searchString: string): boolean {
  return this.includes(searchString);
};

// Add HTMLElement.setText extension used by Obsidian
declare global {
  interface HTMLElement {
    setText(text: string): void;
  }
}

HTMLElement.prototype.setText = function(text: string): void {
  this.textContent = text;
};

// Add HTMLInputElement.trigger extension used by Obsidian
declare global {
  interface HTMLInputElement {
    trigger(eventType: string): void;
  }
}

HTMLInputElement.prototype.trigger = function(eventType: string): void {
  this.dispatchEvent(new Event(eventType, { bubbles: true }));
};

beforeAll(() => {});

afterAll(() => {});

beforeEach(() => {
  jest.clearAllMocks();
});
