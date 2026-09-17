import { SetDueDateCommand } from "../../src/commands/set-due-date";
import { DEFAULT_SETTINGS } from "../../src/settings";

const createEditor = (line: string) => ({
  getCursor: jest.fn(() => ({ line: 0, ch: 0 })),
  getLine: jest.fn(() => line),
  setLine: jest.fn((_lineNumber: number, value: string) => {
    line = value;
  }),
});

describe("SetDueDateCommand", () => {
  it("opens with the current date and replaces it", () => {
    const editor = createEditor("- [ ] Review [due:: 2026-09-18]");
    const openDatePicker = jest.fn((initialDate: string, onSubmit: (date: string) => void) => {
      expect(initialDate).toBe("2026-09-18");
      onSubmit("2026-09-21");
    });
    const command = new SetDueDateCommand({} as never, () => DEFAULT_SETTINGS, openDatePicker);

    expect(command.editorCheckCallback(false, editor as never, {} as never)).toBe(true);
    expect(editor.setLine).toHaveBeenCalledWith(0, "- [ ] Review [due:: 2026-09-21]");
  });

  it("uses the configured attribute and preserves neighboring metadata", () => {
    const editor = createEditor("- [ ] Review [priority:: high]");
    const settings = { ...DEFAULT_SETTINGS, dueDateAttribute: "deadline" };
    const command = new SetDueDateCommand({} as never, () => settings, (_initialDate, onSubmit) => onSubmit("2026-09-21"));

    command.editorCheckCallback(false, editor as never, {} as never);

    expect(editor.setLine).toHaveBeenCalledWith(0, "- [ ] Review [priority:: high] [deadline:: 2026-09-21]");
  });

  it("is unavailable outside task lines", () => {
    const editor = createEditor("A paragraph");
    const openDatePicker = jest.fn();
    const command = new SetDueDateCommand({} as never, () => DEFAULT_SETTINGS, openDatePicker);

    expect(command.editorCheckCallback(false, editor as never, {} as never)).toBe(false);
    expect(openDatePicker).not.toHaveBeenCalled();
  });
});
