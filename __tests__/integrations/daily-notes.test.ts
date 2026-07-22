import { appHasDailyNotesPluginLoaded, getDailyNoteSettings } from "obsidian-daily-notes-interface";

import { readDailyNoteSettings } from "../../src/integrations/daily-notes";

jest.mock("obsidian-daily-notes-interface", () => ({
  appHasDailyNotesPluginLoaded: jest.fn(),
  getDailyNoteSettings: jest.fn(),
}));

const mockIsLoaded = appHasDailyNotesPluginLoaded as jest.MockedFunction<typeof appHasDailyNotesPluginLoaded>;
const mockGetSettings = getDailyNoteSettings as jest.MockedFunction<typeof getDailyNoteSettings>;

describe("readDailyNoteSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoaded.mockReturnValue(true);
  });

  it("returns null when neither daily-note provider is enabled", () => {
    mockIsLoaded.mockReturnValue(false);

    expect(readDailyNoteSettings()).toBeNull();
    expect(mockGetSettings).not.toHaveBeenCalled();
  });

  it("normalizes the ecosystem interface to Task Planner's settings shape", () => {
    mockGetSettings.mockReturnValue({
      folder: "Journal",
      format: "YYYY/MM/DD",
      template: "Templates/Daily.md",
    });

    expect(readDailyNoteSettings()).toEqual({
      folder: "Journal",
      format: "YYYY/MM/DD",
      template: "Templates/Daily.md",
    });
  });

  it("applies canonical defaults to missing optional values", () => {
    mockGetSettings.mockReturnValue({ folder: "", format: "", template: "" });

    expect(readDailyNoteSettings()).toEqual({
      folder: "",
      format: "YYYY-MM-DD",
      template: undefined,
    });
  });

  it("fails closed when the compatibility library cannot read Obsidian internals", () => {
    mockIsLoaded.mockImplementation(() => {
      throw new Error("private API changed");
    });

    expect(readDailyNoteSettings()).toBeNull();
  });
});
