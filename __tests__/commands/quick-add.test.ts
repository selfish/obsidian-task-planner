import { QuickAddCommand } from "../../src/commands/quick-add";

describe("QuickAddCommand", () => {
  let mockOpenModal: jest.Mock;
  let command: QuickAddCommand;

  beforeEach(() => {
    mockOpenModal = jest.fn();
    command = new QuickAddCommand(mockOpenModal);
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
    it("should call the openModal function", () => {
      command.callback();

      expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });

    it("should call openModal each time callback is invoked", () => {
      command.callback();
      command.callback();
      command.callback();

      expect(mockOpenModal).toHaveBeenCalledTimes(3);
    });
  });
});
