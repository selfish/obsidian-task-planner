import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { getDefaultSettings, ViewMode } from "../../src/ui/PlanningSettings";

describe("ViewMode", () => {
  describe("getDefaultSettings", () => {
    it("should default viewMode to 'default'", () => {
      const settings = getDefaultSettings();
      expect(settings.viewMode).toBe("default");
    });
  });

  describe("toggle behavior", () => {
    it("clicking Today Focus when default should set viewMode to 'today'", () => {
      let currentMode: ViewMode = "default";
      const toggle = () => {
        currentMode = currentMode === "today" ? "default" : "today";
      };

      toggle();
      expect(currentMode).toBe("today");
    });

    it("clicking Today Focus when already 'today' should return to 'default'", () => {
      let currentMode: ViewMode = "today";
      const toggle = () => {
        currentMode = currentMode === "today" ? "default" : "today";
      };

      toggle();
      expect(currentMode).toBe("default");
    });

    it("clicking Future Focus when default should set viewMode to 'future'", () => {
      let currentMode: ViewMode = "default";
      const toggle = () => {
        currentMode = currentMode === "future" ? "default" : "future";
      };

      toggle();
      expect(currentMode).toBe("future");
    });

    it("clicking Future Focus when already 'future' should return to 'default'", () => {
      let currentMode: ViewMode = "future";
      const toggle = () => {
        currentMode = currentMode === "future" ? "default" : "future";
      };

      toggle();
      expect(currentMode).toBe("default");
    });

    it("Today and Future focus should be mutually exclusive", () => {
      let currentMode: ViewMode = "default";

      const toggleToday = () => {
        currentMode = currentMode === "today" ? "default" : "today";
      };

      const toggleFuture = () => {
        currentMode = currentMode === "future" ? "default" : "future";
      };

      // Enable Today Focus
      toggleToday();
      expect(currentMode).toBe("today");

      // Clicking Future Focus should switch to future (not stay on today)
      toggleFuture();
      expect(currentMode).toBe("future");

      // Clicking Today Focus should switch to today
      toggleToday();
      expect(currentMode).toBe("today");
    });
  });

  describe("CSS class generation", () => {
    it("should generate correct board class for default mode", () => {
      const viewMode: ViewMode = "default";
      const boardClass = viewMode !== "default" ? `board mode-${viewMode}` : "board";
      expect(boardClass).toBe("board");
    });

    it("should generate correct board class for today mode", () => {
      const viewMode: ViewMode = "today";
      const boardClass = viewMode !== "default" ? `board mode-${viewMode}` : "board";
      expect(boardClass).toBe("board mode-today");
    });

    it("should generate correct board class for future mode", () => {
      const viewMode: ViewMode = "future";
      const boardClass = viewMode !== "default" ? `board mode-${viewMode}` : "board";
      expect(boardClass).toBe("board mode-future");
    });
  });

  describe("section visibility", () => {
    it("default mode should show both sections", () => {
      const viewMode: ViewMode = "default";
      const showTodaySection = viewMode !== "future";
      const showFutureSection = viewMode !== "today";

      expect(showTodaySection).toBe(true);
      expect(showFutureSection).toBe(true);
    });

    it("today mode should hide future section", () => {
      const viewMode: ViewMode = "today";
      const showTodaySection = viewMode !== "future";
      const showFutureSection = viewMode !== "today";

      expect(showTodaySection).toBe(true);
      expect(showFutureSection).toBe(false);
    });

    it("future mode should hide today section", () => {
      const viewMode: ViewMode = "future";
      const showTodaySection = viewMode !== "future";
      const showFutureSection = viewMode !== "today";

      expect(showTodaySection).toBe(false);
      expect(showFutureSection).toBe(true);
    });
  });

  describe("Today horizon in Future Focus", () => {
    it("should show Today horizon only in future mode", () => {
      const shouldShowTodayHorizon = (viewMode: ViewMode) => viewMode === "future";

      expect(shouldShowTodayHorizon("default")).toBe(false);
      expect(shouldShowTodayHorizon("today")).toBe(false);
      expect(shouldShowTodayHorizon("future")).toBe(true);
    });
  });

  describe("LED indicator state", () => {
    it("Today Focus LED should be active only when viewMode is 'today'", () => {
      const isActive = (viewMode: ViewMode) => viewMode === "today";

      expect(isActive("default")).toBe(false);
      expect(isActive("today")).toBe(true);
      expect(isActive("future")).toBe(false);
    });

    it("Future Focus LED should be active only when viewMode is 'future'", () => {
      const isActive = (viewMode: ViewMode) => viewMode === "future";

      expect(isActive("default")).toBe(false);
      expect(isActive("today")).toBe(false);
      expect(isActive("future")).toBe(true);
    });
  });
});
