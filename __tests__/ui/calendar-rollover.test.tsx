import * as React from "react";
import { act, fireEvent, render, within } from "@testing-library/react";
import { App, TFile } from "obsidian";

import { TaskIndex } from "../../src/core";
import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { PlanningComponent } from "../../src/ui/planning-component";
import { PlanningTodoColumnProps } from "../../src/ui/planning-task-column";
import { TaskReportComponent } from "../../src/ui/task-report-component";
import { useCurrentDay } from "../../src/ui/use-current-day";
import { TaskItem, TaskStatus } from "../../src/types/task";

jest.mock("../../src/ui/planning-task-column", () => ({
  PlanningTaskColumn: ({ title, todos }: PlanningTodoColumnProps) => (
    <section data-testid={title.split("\n")[0]}>
      <h2>{title}</h2>
      {todos.map((todo) => (
        <span key={todo.line}>{todo.text}</span>
      ))}
    </section>
  ),
}));
jest.mock("../../src/ui/task-list-component", () => ({
  TaskListComponent: ({ todos }: { todos: TaskItem<TFile>[] }) => (
    <ul>
      {todos.map((todo) => (
        <li key={todo.line}>{todo.text}</li>
      ))}
    </ul>
  ),
}));

function task(text: string, status: TaskStatus, line: number, attributes: Record<string, string>): TaskItem<TFile> {
  const path = "Calendar.md";
  return { text, status, line, attributes, file: { id: path, file: new TFile(path) } };
}

function setup(kind: "board" | "report", tasks: TaskItem<TFile>[], container?: HTMLElement) {
  const unsubscribe = jest.fn();
  const taskIndex = { tasks, onUpdateEvent: { listen: jest.fn(() => unsubscribe) } } as unknown as TaskIndex<TFile>;
  const app = { loadLocalStorage: jest.fn(() => null), saveLocalStorage: jest.fn() } as unknown as App;
  const settings = { ...DEFAULT_SETTINGS, undo: { ...DEFAULT_SETTINGS.undo, showUndoToast: false } };
  const deps = { app, taskIndex, settings, logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } };
  const view = kind === "board" ? <PlanningComponent deps={deps} settings={settings} app={app} /> : <TaskReportComponent deps={deps} />;
  return { ...render(view, container ? { container } : undefined), tasks, unsubscribe, taskIndex, app };
}

function reportSection(container: HTMLElement, title: string) {
  const section = [...container.querySelectorAll<HTMLElement>(".report-section")].find((candidate) => candidate.querySelector(".section-title")?.textContent === title);
  if (!section) throw new Error(`Missing report section: ${title}`);
  return section;
}

describe("board and report calendar rollover", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-30T23:59:00"));
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("updates board Today, Overdue, Tomorrow and the completed-today badge without an index event", () => {
    const tasks = [
      task("Old day", TaskStatus.Todo, 1, { due: "2026-09-30" }),
      task("New day", TaskStatus.Todo, 2, { due: "2026-10-01" }),
      task("Next tomorrow", TaskStatus.Todo, 3, { due: "2026-10-02" }),
      task("Old completion", TaskStatus.Complete, 4, { due: "2026-09-30", completed: "2026-09-30" }),
    ];
    const original = JSON.stringify(tasks);
    const { container, getByTestId, taskIndex, app } = setup("board", tasks);
    expect(within(getByTestId("Todo")).getByText("Old day")).toBeInTheDocument();
    expect(within(getByTestId("Tomorrow")).getByText("New day")).toBeInTheDocument();
    expect(container.querySelector(".stats .stat")).toHaveTextContent("1 done");

    act(() => jest.advanceTimersByTime(60_001));

    expect(within(getByTestId("Todo")).getByText("New day")).toBeInTheDocument();
    expect(within(getByTestId("Overdue")).getByText("Old day")).toBeInTheDocument();
    expect(within(getByTestId("Tomorrow")).getByText("Next tomorrow")).toBeInTheDocument();
    expect(container.querySelector(".stats .stat")).toHaveTextContent("0 done");
    expect(JSON.stringify(tasks)).toBe(original);
    expect(taskIndex.onUpdateEvent.listen).toHaveBeenCalledTimes(1);
    expect(app.saveLocalStorage).not.toHaveBeenCalled();
  });

  it("moves a future report completion into the current period and preserves filters and collapse state", () => {
    const tasks = [task("Alpha tomorrow", TaskStatus.Complete, 1, { completed: "2026-10-01" }), task("Alpha undated", TaskStatus.Complete, 2, {}), task("Beta canceled", TaskStatus.Canceled, 3, {})];
    const original = JSON.stringify(tasks);
    const { container } = setup("report", tasks);
    fireEvent.change(container.querySelector(".search")!, { target: { value: "Alpha" } });
    fireEvent.change(container.querySelector(".status-filter")!, { target: { value: "completed" } });
    fireEvent.click(reportSection(container, "No completion date").querySelector(".section-header")!);
    expect(within(reportSection(container, "Future completion date")).getByText("Alpha tomorrow")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(60_001));

    expect(within(reportSection(container, "Sep 28 - Oct 1")).getByText("Alpha tomorrow")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("Future completion date");
    expect(reportSection(container, "No completion date")).toHaveClass("collapsed");
    expect(container.querySelector(".search")).toHaveValue("Alpha");
    expect(container.querySelector(".status-filter")).toHaveValue("completed");
    expect(container.querySelector(".result-count")).toHaveTextContent("2 tasks in 2 periods");
    expect(JSON.stringify(tasks)).toBe(original);
  });

  it.each([
    ["2026-09-27", "2026-09-28", "Sep 28 - Sep 28"],
    ["2026-12-31", "2027-01-01", "Dec 28, 2026 - Jan 1, 2027"],
  ])("refreshes report period titles across %s / %s", (before, after, title) => {
    jest.setSystemTime(new Date(`${before}T23:59:00`));
    const { container } = setup("report", [task("Boundary completion", TaskStatus.Complete, 1, { completed: after })]);
    act(() => jest.advanceTimersByTime(60_001));
    expect(within(reportSection(container, title)).getAllByText("Boundary completion")).toHaveLength(1);
    expect(container.querySelector(".result-count")).toHaveTextContent("1 task in 1 period");
  });

  it.each(["board", "report"] as const)("recovers the %s after suspension and owns exactly one cleaned-up timer", (kind) => {
    const visibility = jest.spyOn(document, "visibilityState", "get");
    const removeWindow = jest.spyOn(window, "removeEventListener");
    const removeDocument = jest.spyOn(document, "removeEventListener");
    const tasks = [task("Wake task", kind === "board" ? TaskStatus.Todo : TaskStatus.Complete, 1, { due: "2027-01-02", completed: "2027-01-02" })];
    const { container, unmount, unsubscribe } = setup(kind, tasks);
    expect(jest.getTimerCount()).toBe(1);
    act(() => {
      jest.setSystemTime(new Date("2027-01-02T08:00:00"));
      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    if (kind === "report") expect(container).toHaveTextContent("Future completion date");
    act(() => {
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
    });
    if (kind === "board") expect(within(container.querySelector('[data-testid="Todo"]') as HTMLElement).getByText("Wake task")).toBeInTheDocument();
    else expect(container).not.toHaveTextContent("Future completion date");
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(removeWindow).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  it.each(["board", "report"] as const)("uses the %s view's owning window, including pop-outs", (kind) => {
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const ownerWindow = frame.contentWindow!;
    const ownerDocument = frame.contentDocument!;
    const timer = jest.spyOn(ownerWindow, "setTimeout");
    const ownerFocus = jest.spyOn(ownerWindow, "addEventListener");
    const mainFocus = jest.spyOn(window, "addEventListener");
    const { unmount } = setup(kind, [], ownerDocument.body);
    expect(timer).toHaveBeenCalledTimes(1);
    expect(ownerFocus).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(mainFocus).not.toHaveBeenCalledWith("focus", expect.any(Function));
    unmount();
    frame.remove();
  });

  it("does not schedule a clock before a container is attached", () => {
    function DetachedClock() {
      useCurrentDay(React.useRef<HTMLElement>(null));
      return null;
    }
    const { unmount } = render(<DetachedClock />);
    expect(jest.getTimerCount()).toBe(0);
    unmount();
  });

  it("does not fall back to the main window for a document without a browsing context", () => {
    const detachedDocument = document.implementation.createHTMLDocument("Detached view");
    const mainFocus = jest.spyOn(window, "addEventListener");
    expect(detachedDocument.defaultView).toBeNull();
    const { unmount } = setup("report", [], detachedDocument.body);
    expect(jest.getTimerCount()).toBe(0);
    expect(mainFocus).not.toHaveBeenCalledWith("focus", expect.any(Function));
    unmount();
  });
});
