import versions from "../versions.json";

describe("Obsidian version compatibility", () => {
  it("preserves the minimum app version declared by each immutable release", () => {
    expect(versions).toEqual({
      "1.0.0": "0.9.7",
      "1.0.1": "1.0.0",
      "1.0.2": "1.0.0",
      "1.0.3": "1.0.0",
      "1.0.4": "1.0.0",
      "1.1.0": "1.0.0",
      "1.1.1": "1.0.0",
      "1.2.0": "1.0.0",
      "1.3.0": "1.0.0",
      "1.4.0": "1.0.0",
      "1.5.0": "1.0.0",
      "2.0.0": "1.0.0",
      "2.0.1": "1.0.0",
      "2.0.2": "1.4.10",
    });
  });
});
