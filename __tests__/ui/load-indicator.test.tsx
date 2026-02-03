import { getLoadLevel, LoadLevel } from "../../src/ui/load-indicator";

describe("LoadIndicator", () => {
  describe("getLoadLevel", () => {
    describe("when WIP limit is enabled", () => {
      const isLimited = true;
      const wipLimit = 5;

      it("should return 'light' when under 50% of limit", () => {
        expect(getLoadLevel(0, wipLimit, isLimited)).toBe("light");
        expect(getLoadLevel(1, wipLimit, isLimited)).toBe("light");
        expect(getLoadLevel(2, wipLimit, isLimited)).toBe("light");
      });

      it("should return 'normal' when between 50-80% of limit", () => {
        expect(getLoadLevel(3, wipLimit, isLimited)).toBe("normal");
        expect(getLoadLevel(4, wipLimit, isLimited)).toBe("normal");
      });

      it("should return 'heavy' when between 80-100% of limit", () => {
        expect(getLoadLevel(5, wipLimit, isLimited)).toBe("heavy");
      });

      it("should return 'overloaded' when over 100% of limit", () => {
        expect(getLoadLevel(6, wipLimit, isLimited)).toBe("overloaded");
        expect(getLoadLevel(10, wipLimit, isLimited)).toBe("overloaded");
      });
    });

    describe("when WIP limit is disabled", () => {
      const isLimited = false;
      const wipLimit = 5; // Should be ignored

      it("should return 'light' when 3 or fewer tasks", () => {
        expect(getLoadLevel(0, wipLimit, isLimited)).toBe("light");
        expect(getLoadLevel(1, wipLimit, isLimited)).toBe("light");
        expect(getLoadLevel(3, wipLimit, isLimited)).toBe("light");
      });

      it("should return 'normal' when 4-5 tasks", () => {
        expect(getLoadLevel(4, wipLimit, isLimited)).toBe("normal");
        expect(getLoadLevel(5, wipLimit, isLimited)).toBe("normal");
      });

      it("should return 'heavy' when 6-8 tasks", () => {
        expect(getLoadLevel(6, wipLimit, isLimited)).toBe("heavy");
        expect(getLoadLevel(8, wipLimit, isLimited)).toBe("heavy");
      });

      it("should return 'overloaded' when more than 8 tasks", () => {
        expect(getLoadLevel(9, wipLimit, isLimited)).toBe("overloaded");
        expect(getLoadLevel(15, wipLimit, isLimited)).toBe("overloaded");
      });
    });

    describe("edge cases", () => {
      it("should handle zero WIP limit gracefully", () => {
        // When limit is 0, use absolute thresholds
        expect(getLoadLevel(3, 0, true)).toBe("light");
        expect(getLoadLevel(5, 0, true)).toBe("normal");
      });

      it("should handle negative WIP limit gracefully", () => {
        // When limit is negative, use absolute thresholds
        expect(getLoadLevel(3, -1, true)).toBe("light");
      });
    });
  });
});
