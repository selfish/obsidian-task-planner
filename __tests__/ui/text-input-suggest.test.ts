import { App } from 'obsidian';
import { TextInputSuggest } from '../../src/ui/text-input-suggest';

// Concrete implementation for testing the abstract class
class TestTextInputSuggest extends TextInputSuggest<string> {
  private suggestions: string[] = [];

  setSuggestions(suggestions: string[]): void {
    this.suggestions = suggestions;
  }

  getSuggestions(inputStr: string): string[] {
    return this.suggestions.filter(s => s.toLowerCase().includes(inputStr.toLowerCase()));
  }

  renderSuggestion(item: string, el: HTMLElement): void {
    el.textContent = item;
  }

  selectSuggestion(item: string, _evt: MouseEvent | KeyboardEvent): void {
    this.inputEl.value = item;
  }

  // Expose protected members for testing
  getInputEl(): HTMLInputElement {
    return this.inputEl;
  }

  getApp(): App {
    return this.app;
  }
}

describe('TextInputSuggest', () => {
  let mockApp: App;
  let mockInputEl: HTMLInputElement;
  let suggest: TestTextInputSuggest;

  beforeEach(() => {
    mockApp = new App();
    mockInputEl = document.createElement('input');
    suggest = new TestTextInputSuggest(mockInputEl, mockApp);
  });

  describe('constructor', () => {
    it('should store the input element', () => {
      expect(suggest.getInputEl()).toBe(mockInputEl);
    });

    it('should call parent constructor with app and inputEl', () => {
      // The abstract class stores app via super()
      expect(suggest.getApp()).toBe(mockApp);
    });
  });

  describe('abstract methods implementation', () => {
    it('should implement getSuggestions', () => {
      suggest.setSuggestions(['apple', 'banana', 'apricot']);

      const results = suggest.getSuggestions('ap');

      expect(results).toEqual(['apple', 'apricot']);
    });

    it('should implement renderSuggestion', () => {
      const el = document.createElement('div');

      suggest.renderSuggestion('test item', el);

      expect(el.textContent).toBe('test item');
    });

    it('should implement selectSuggestion', () => {
      suggest.selectSuggestion('selected value', new MouseEvent('click'));

      expect(mockInputEl.value).toBe('selected value');
    });
  });

  describe('inherited behavior', () => {
    it('should have access to inputEl in subclass', () => {
      const inputEl = suggest.getInputEl();

      expect(inputEl).toBeDefined();
      expect(inputEl).toBeInstanceOf(HTMLInputElement);
    });

    it('should have close method from parent', () => {
      expect(typeof suggest.close).toBe('function');
    });

    it('should have open method from parent', () => {
      expect(typeof suggest.open).toBe('function');
    });
  });
});

describe('TextInputSuggest with different types', () => {
  interface CustomItem {
    id: number;
    name: string;
  }

  class CustomItemSuggest extends TextInputSuggest<CustomItem> {
    private items: CustomItem[] = [];

    setItems(items: CustomItem[]): void {
      this.items = items;
    }

    getSuggestions(inputStr: string): CustomItem[] {
      return this.items.filter(item =>
        item.name.toLowerCase().includes(inputStr.toLowerCase())
      );
    }

    renderSuggestion(item: CustomItem, el: HTMLElement): void {
      el.textContent = `${item.id}: ${item.name}`;
    }

    selectSuggestion(item: CustomItem, _evt: MouseEvent | KeyboardEvent): void {
      this.inputEl.value = item.name;
    }
  }

  it('should work with custom object types', () => {
    const app = new App();
    const inputEl = document.createElement('input');
    const suggest = new CustomItemSuggest(inputEl, app);

    suggest.setItems([
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' },
      { id: 3, name: 'Third' },
    ]);

    const results = suggest.getSuggestions('ir');

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('First');
    expect(results[1].name).toBe('Third');
  });

  it('should render custom objects correctly', () => {
    const app = new App();
    const inputEl = document.createElement('input');
    const suggest = new CustomItemSuggest(inputEl, app);
    const el = document.createElement('div');

    suggest.renderSuggestion({ id: 42, name: 'Answer' }, el);

    expect(el.textContent).toBe('42: Answer');
  });
});
