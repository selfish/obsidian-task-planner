import versions from "../versions.json";
import manifest from "../manifest.json";
import packageJson from "../package.json";

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
      "2.0.3": "1.8.7",
      "2.0.4": "1.8.7",
      "2.0.5": "1.8.7",
      "2.0.6": "1.8.7",
    });
  });

  it("keeps current release metadata aligned", () => {
    expect(packageJson.version).toBe(manifest.version);
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });
});
