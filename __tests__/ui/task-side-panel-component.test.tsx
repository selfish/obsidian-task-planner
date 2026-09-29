import * as React from "react";

import { act, render, within } from "@testing-library/react";
import { App, TFile } from "obsidian";

import { TaskIndex } from "../../src/core";
import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { TodoSidePanelComponent } from "../../src/ui/task-side-panel-component";
import { TaskItem, TaskStatus } from "../../src/types/task";

jest.mock("../../src/ui/task-item-component", () => ({
  TodoItemComponent: ({ todo }: { todo: TaskItem<TFile> }) => <span>{todo.text}</span>,
}));

function task(text: string, status: TaskStatus, line: number, attributes: Record<string, string>): TaskItem<TFile> {
  const path = `Tasks/${line}.md`;
  return {
    text,
    status,
    line,
    attributes,
    file: { id: path, file: new TFile(path) },
  };
}

function setup(tasks: TaskItem<TFile>[], container?: HTMLElement) {
  const unsubscribe = jest.fn();
  const taskIndex = {
    tasks,
    onUpdateEvent: { listen: jest.fn(() => unsubscribe) },
  } as unknown as TaskIndex<TFile>;
  const app = {
    loadLocalStorage: jest.fn(() => null),
    saveLocalStorage: jest.fn(),
  } as unknown as App;
  const view = (
    <TodoSidePanelComponent
      deps={{
        app,
        settings: DEFAULT_SETTINGS,
        taskIndex,
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      }}
    />
  );
  const result = container ? render(view, { container }) : render(view);
  return { ...result, unsubscribe };
}

function section(container: HTMLElement, title: string): HTMLElement {
  const match = Array.from(container.querySelectorAll<HTMLElement>(".sidebar-section")).find((candidate) => candidate.querySelector(".title")?.textContent === title);
  if (!match) throw new Error(`Missing section: ${title}`);
  return match;
}

function expectCount(container: HTMLElement, title: string, count: number): void {
  expect(within(section(container, title)).getByText(String(count), { selector: ".count" })).toBeInTheDocument();
}

describe("Today Focus day rollover", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-30T23:59:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("moves due and completed tasks to their new sections at local midnight", () => {
    const { container } = setup([
      task("Due before midnight", TaskStatus.Todo, 1, { due: "2026-09-30" }),
      task("Due after midnight", TaskStatus.Todo, 2, { due: "2026-10-01" }),
      task("Done before midnight", TaskStatus.Complete, 3, { completed: "2026-09-30" }),
    ]);

    expectCount(container, "Overdue", 0);
    expectCount(container, "Today", 1);
    expectCount(container, "Done Today", 1);

    act(() => {
      jest.advanceTimersByTime(2 * 60 * 1000);
    });

    expectCount(container, "Overdue", 1);
    expect(within(section(container, "Overdue")).getByText("Due before midnight")).toBeInTheDocument();
    expectCount(container, "Today", 1);
    expect(within(section(container, "Today")).getByText("Due after midnight")).toBeInTheDocument();
    expectCount(container, "Done Today", 0);
  });

  it("refreshes and reschedules on focus after a long suspension across a year boundary", () => {
    jest.setSystemTime(new Date("2026-12-31T23:59:00"));
    const { container } = setup([task("New year task", TaskStatus.Todo, 1, { due: "2027-01-02" })]);

    expectCount(container, "Today", 0);

    act(() => {
      jest.setSystemTime(new Date("2027-01-02T08:00:00"));
      window.dispatchEvent(new Event("focus"));
    });

    expectCount(container, "Today", 1);
    expect(within(section(container, "Today")).getByText("New year task")).toBeInTheDocument();
  });

  it("removes its clock and wake listeners when unmounted", () => {
    const clearTimeoutSpy = jest.spyOn(window, "clearTimeout");
    const removeWindowListenerSpy = jest.spyOn(window, "removeEventListener");
    const removeDocumentListenerSpy = jest.spyOn(document, "removeEventListener");
    const { unmount, unsubscribe } = setup([]);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(removeWindowListenerSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(removeDocumentListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("Today Focus clock ownership", () => {
  it("uses the view's owning window for wake events and the midnight timer", () => {
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const ownerDocument = frame.contentDocument!;
    const ownerWindow = frame.contentWindow!;
    const setTimeoutSpy = jest.spyOn(ownerWindow, "setTimeout");
    const addWindowListenerSpy = jest.spyOn(ownerWindow, "addEventListener");
    const mainWindowListenerSpy = jest.spyOn(window, "addEventListener");

    const { unmount } = setup([], ownerDocument.body);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(addWindowListenerSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(mainWindowListenerSpy).not.toHaveBeenCalledWith("focus", expect.any(Function));

    unmount();
    frame.remove();
  });
});
