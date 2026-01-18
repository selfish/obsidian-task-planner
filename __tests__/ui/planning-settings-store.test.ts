import { App } from 'obsidian';
import { PlanningSettingsStore } from '../../src/ui/planning-settings-store';
import { PlanningSettings, getDefaultSettings } from '../../src/ui/planning-settings';

// Extend App mock with localStorage methods
interface MockApp extends App {
  loadLocalStorage: jest.Mock;
  saveLocalStorage: jest.Mock;
}

const createMockApp = (): MockApp => {
  const app = new App() as MockApp;
  app.loadLocalStorage = jest.fn();
  app.saveLocalStorage = jest.fn();
  return app;
};

describe('PlanningSettingsStore', () => {
  let mockApp: MockApp;
  let store: PlanningSettingsStore;

  beforeEach(() => {
    mockApp = createMockApp();
    store = new PlanningSettingsStore(mockApp);
  });

  describe('constructor', () => {
    it('should create an instance with app reference', () => {
      expect(store).toBeInstanceOf(PlanningSettingsStore);
    });
  });

  describe('getSettings', () => {
    it('should return default settings when nothing is stored', () => {
      mockApp.loadLocalStorage.mockReturnValue(null);

      const settings = store.getSettings();

      expect(settings).toEqual(getDefaultSettings());
    });

    it('should load and parse stored settings', () => {
      const storedSettings: Partial<PlanningSettings> = {
        showCompleted: true,
      };
      mockApp.loadLocalStorage.mockReturnValue(JSON.stringify(storedSettings));

      const settings = store.getSettings();

      expect(settings.showCompleted).toBe(true);
    });

    it('should merge stored settings with defaults', () => {
      const partialSettings = { showCompleted: false };
      mockApp.loadLocalStorage.mockReturnValue(JSON.stringify(partialSettings));

      const settings = store.getSettings();
      const defaults = getDefaultSettings();

      // Should have the stored value
      expect(settings.showCompleted).toBe(false);
      // Should have defaults for other properties
      expect(settings.showBacklog).toBe(defaults.showBacklog);
    });

    it('should use correct storage key', () => {
      mockApp.loadLocalStorage.mockReturnValue(null);

      store.getSettings();

      expect(mockApp.loadLocalStorage).toHaveBeenCalledWith('TaskPlanner.PlanningSettings');
    });

    it('should handle invalid JSON gracefully', () => {
      mockApp.loadLocalStorage.mockReturnValue('not valid json');

      expect(() => store.getSettings()).toThrow();
    });

    it('should handle empty string', () => {
      mockApp.loadLocalStorage.mockReturnValue('');

      const settings = store.getSettings();

      // Empty string is falsy, should return defaults
      expect(settings).toEqual(getDefaultSettings());
    });
  });

  describe('saveSettings', () => {
    it('should save settings to local storage', () => {
      const settings: PlanningSettings = {
        ...getDefaultSettings(),
        showCompleted: true,
      };

      store.saveSettings(settings);

      expect(mockApp.saveLocalStorage).toHaveBeenCalledWith(
        'TaskPlanner.PlanningSettings',
        JSON.stringify(settings)
      );
    });

    it('should serialize settings to JSON', () => {
      const settings = getDefaultSettings();

      store.saveSettings(settings);

      const savedValue = mockApp.saveLocalStorage.mock.calls[0][1];
      expect(() => JSON.parse(savedValue)).not.toThrow();
      expect(JSON.parse(savedValue)).toEqual(settings);
    });
  });

  describe('decorateSetterWithSaveSettings', () => {
    it('should call the original setter', () => {
      const setter = jest.fn();
      const decoratedSetter = store.decorateSetterWithSaveSettings(setter);
      const settings = getDefaultSettings();

      decoratedSetter(settings);

      expect(setter).toHaveBeenCalledWith(settings);
    });

    it('should save settings after calling setter', () => {
      const setter = jest.fn();
      const decoratedSetter = store.decorateSetterWithSaveSettings(setter);
      const settings = getDefaultSettings();

      decoratedSetter(settings);

      expect(mockApp.saveLocalStorage).toHaveBeenCalled();
    });

    it('should call setter before saving', () => {
      const callOrder: string[] = [];
      const setter = jest.fn(() => callOrder.push('setter'));
      mockApp.saveLocalStorage.mockImplementation(() => callOrder.push('save'));

      const decoratedSetter = store.decorateSetterWithSaveSettings(setter);
      decoratedSetter(getDefaultSettings());

      expect(callOrder).toEqual(['setter', 'save']);
    });

    it('should pass correct settings to save', () => {
      const setter = jest.fn();
      const decoratedSetter = store.decorateSetterWithSaveSettings(setter);
      const settings: PlanningSettings = {
        ...getDefaultSettings(),
        showCompleted: true,
        showBacklog: false,
      };

      decoratedSetter(settings);

      expect(mockApp.saveLocalStorage).toHaveBeenCalledWith(
        'TaskPlanner.PlanningSettings',
        JSON.stringify(settings)
      );
    });

    it('should return a function', () => {
      const setter = jest.fn();
      const decoratedSetter = store.decorateSetterWithSaveSettings(setter);

      expect(typeof decoratedSetter).toBe('function');
    });
  });
});
