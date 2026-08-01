import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { App, TFile } from "obsidian";

import { TaskIndex } from "../../src/core";
import { UndoManager } from "../../src/core/operations/undo-manager";
import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { PlanningComponent } from "../../src/ui/planning-component";

function renderPlanner() {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const ownerDocument = frame.contentDocument!;
  const ownerWindow = frame.contentWindow!;
  const taskIndex = {
    tasks: [],
    onUpdateEvent: { listen: jest.fn(() => jest.fn()) },
  } as unknown as TaskIndex<TFile>;
  const undoManager = {
    canUndo: jest.fn(() => true),
    popForUndo: jest.fn(() => null),
  } as unknown as UndoManager;
  const app = {
    loadLocalStorage: jest.fn(() => null),
    saveLocalStorage: jest.fn(),
  } as unknown as App;
  const settings = {
    ...DEFAULT_SETTINGS,
    undo: { ...DEFAULT_SETTINGS.undo, showUndoToast: false },
  };

  const result = render(
    <PlanningComponent
      deps={{
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        taskIndex,
        undoManager,
      }}
      settings={settings}
      app={app}
    />,
    { container: ownerDocument.body }
  );

  return { ...result, frame, ownerDocument, ownerWindow, undoManager };
}

describe("PlanningComponent window ownership", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("scopes undo to key events inside the popped-out board", () => {
    const { container, ownerDocument, undoManager } = renderPlanner();
    const board = container.querySelector(".board")!;

    fireEvent.keyDown(ownerDocument.body, { key: "z", ctrlKey: true });
    expect(undoManager.canUndo).not.toHaveBeenCalled();

    const event = new ownerDocument.defaultView!.KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    board.dispatchEvent(event);

    expect(undoManager.canUndo).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("uses the live future section and its owning window after mode transitions", () => {
    const { container, ownerWindow } = renderPlanner();
    const initialFutureSection = container.querySelector(".future-section")!;
    const setIntervalSpy = jest.spyOn(ownerWindow, "setInterval").mockReturnValue(123);
    const clearIntervalSpy = jest.spyOn(ownerWindow, "clearInterval").mockImplementation(() => undefined);
    const mainWindowSetIntervalSpy = jest.spyOn(window, "setInterval");

    fireEvent.click(container.querySelector('button[aria-label="Today focus"]')!);
    expect(container.querySelector(".future-section")).toBeNull();
    fireEvent.click(container.querySelector('button[aria-label="Today focus"]')!);

    const currentFutureSection = container.querySelector(".future-section") as HTMLDivElement;
    expect(currentFutureSection).not.toBe(initialFutureSection);
    jest.spyOn(currentFutureSection, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 1000,
      top: 0,
      bottom: 100,
      width: 1000,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    currentFutureSection.dispatchEvent(new MouseEvent("dragover", { clientX: 10, bubbles: true }));
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(mainWindowSetIntervalSpy).not.toHaveBeenCalled();

    fireEvent.drop(currentFutureSection);
    expect(clearIntervalSpy).toHaveBeenCalledWith(123);
  });
});
