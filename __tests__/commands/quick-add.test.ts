import { Workspace, WorkspaceLeaf } from "obsidian";

import { QuickAddCommand } from "../../src/commands/quick-add";
import { PlanningView } from "../../src/views";

describe("QuickAddCommand", () => {
  let mockWorkspace: Workspace;
  let command: QuickAddCommand;

  beforeEach(() => {
    mockWorkspace = {
      getLeavesOfType: jest.fn(),
      setActiveLeaf: jest.fn(),
      getMostRecentLeaf: jest.fn(),
    } as unknown as Workspace;
    command = new QuickAddCommand(mockWorkspace);
  });

  describe("properties", () => {
    it("should have correct id", () => {
      expect(command.id).toBe("quick-add-task");
    });

    it("should have correct name", () => {
      expect(command.name).toBe("Quick add task");
    });

    it("should have correct icon", () => {
      expect(command.icon).toBe("plus");
    });
  });

  describe("callback", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should focus existing planning view when open", () => {
      const mockButton = document.createElement("button");
      mockButton.click = jest.fn();

      const mockContainer = {
        querySelector: jest.fn().mockReturnValue(mockButton),
      };

      const mockLeaf = {
        view: {
          containerEl: mockContainer,
        },
      } as unknown as WorkspaceLeaf;

      (mockWorkspace.getLeavesOfType as jest.Mock).mockReturnValue([mockLeaf]);

      command.callback();

      expect(mockWorkspace.getLeavesOfType).toHaveBeenCalledWith(PlanningView.viewType);
      expect(mockWorkspace.setActiveLeaf).toHaveBeenCalledWith(mockLeaf, { focus: true });

      jest.advanceTimersByTime(50);

      expect(mockContainer.querySelector).toHaveBeenCalledWith(".quick-add-input, .settings-btn[aria-label='Quick add task']");
      expect(mockButton.click).toHaveBeenCalled();
    });

    it("should open planning view when not already open", () => {
      const mockButton = document.createElement("button");
      mockButton.click = jest.fn();

      const mockContainer = {
        querySelector: jest.fn().mockReturnValue(mockButton),
      };

      const mockLeaf = {
        view: {
          containerEl: mockContainer,
        },
        setViewState: jest.fn().mockResolvedValue(undefined),
      } as unknown as WorkspaceLeaf;

      (mockWorkspace.getLeavesOfType as jest.Mock).mockReturnValue([]);
      (mockWorkspace.getMostRecentLeaf as jest.Mock).mockReturnValue(mockLeaf);

      command.callback();

      expect(mockWorkspace.getLeavesOfType).toHaveBeenCalledWith(PlanningView.viewType);
      expect(mockLeaf.setViewState).toHaveBeenCalledWith({ type: PlanningView.viewType });
    });

    it("should handle case when no leaf is available", () => {
      (mockWorkspace.getLeavesOfType as jest.Mock).mockReturnValue([]);
      (mockWorkspace.getMostRecentLeaf as jest.Mock).mockReturnValue(null);

      // Should not throw
      expect(() => command.callback()).not.toThrow();
    });

    it("should handle case when quick add button is not found", () => {
      const mockContainer = {
        querySelector: jest.fn().mockReturnValue(null),
      };

      const mockLeaf = {
        view: {
          containerEl: mockContainer,
        },
      } as unknown as WorkspaceLeaf;

      (mockWorkspace.getLeavesOfType as jest.Mock).mockReturnValue([mockLeaf]);

      command.callback();

      jest.advanceTimersByTime(50);

      // Should not throw when button is not found
      expect(mockContainer.querySelector).toHaveBeenCalled();
    });

    it("should click quick add button after opening planning view", async () => {
      const mockButton = document.createElement("button");
      mockButton.click = jest.fn();

      const mockContainer = {
        querySelector: jest.fn().mockReturnValue(mockButton),
      };

      const mockLeaf = {
        view: {
          containerEl: mockContainer,
        },
        setViewState: jest.fn().mockResolvedValue(undefined),
      } as unknown as WorkspaceLeaf;

      (mockWorkspace.getLeavesOfType as jest.Mock).mockReturnValue([]);
      (mockWorkspace.getMostRecentLeaf as jest.Mock).mockReturnValue(mockLeaf);

      command.callback();

      // Wait for the setViewState promise to resolve
      await Promise.resolve();
      jest.advanceTimersByTime(100);

      expect(mockContainer.querySelector).toHaveBeenCalledWith(".settings-btn[aria-label='Quick add task']");
      expect(mockButton.click).toHaveBeenCalled();
    });
  });
});
