import "@testing-library/jest-dom";
import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { App, TFile } from "obsidian";
import { TaskIndex } from "../../src/core";
import { UndoManager } from "../../src/core/operations/undo-manager";
import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { PlanningComponent } from "../../src/ui/planning-component";
import { TaskListComponent } from "../../src/ui/task-list-component";
import { TodoItemComponent } from "../../src/ui/task-item-component";
import { TaskItem, TaskStatus, getTaskId } from "../../src/types/task";
import { Consts } from "../../src/types/constants";

jest.mock("../../src/ui/markdown-text", () => ({ MarkdownText: ({ text }: { text: string }) => <span>{text}</span> }));

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
function setup(hideEmpty = false, container?: HTMLElement) {
  const undoManager = { canUndo: jest.fn(() => true), popForUndo: jest.fn(() => null) } as unknown as UndoManager;
  const app = { loadLocalStorage: jest.fn(() => JSON.stringify({ hideEmpty })), saveLocalStorage: jest.fn() } as unknown as App;
  const result = render(
    <PlanningComponent deps={{ logger, taskIndex: { tasks: [], onUpdateEvent: { listen: jest.fn(() => jest.fn()) } } as unknown as TaskIndex<TFile>, undoManager }} settings={{ ...DEFAULT_SETTINGS, undo: { ...DEFAULT_SETTINGS.undo, showUndoToast: false } }} app={app} />,
    container ? { container } : undefined
  );
  return { ...result, undoManager, app };
}

test.each([false, true])("preserves hideEmpty=%s across ignored-only toggles and other preference saves", (initial) => {
  const { getByRole, app } = setup(initial);
  const empty = getByRole("button", { name: "Hide empty horizons" });
  const ignored = getByRole("button", { name: "View ignored tasks only" });
  for (let i = 0; i < 2; i++) {
    fireEvent.click(ignored);
    expect(empty).toHaveClass("active");
    fireEvent.change(getByRole("combobox", { name: "Filter by priority" }), { target: { value: i ? "low" : "high" } });
    expect(JSON.parse((app.saveLocalStorage as jest.Mock).mock.calls.at(-1)[1]).hideEmpty).toBe(initial);
    fireEvent.click(ignored);
    expect(empty.classList.contains("active")).toBe(initial);
  }
});

test.each(["input", "textarea", "contenteditable", "nested-contenteditable"])("%s undo does not consume task history (including a separate document)", (kind) => {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const { container, undoManager, unmount } = setup(false, frame.contentDocument!.body);
  const board = container.querySelector(".task-planner") || container.firstElementChild!;
  const editable = container.ownerDocument.createElement(kind === "input" || kind === "textarea" ? kind : "div");
  if (kind.includes("contenteditable")) editable.setAttribute("contenteditable", "true");
  board.appendChild(editable);
  const target = kind === "nested-contenteditable" ? editable.appendChild(document.createElement("span")) : editable;
  for (const modifier of ["ctrlKey", "metaKey"]) {
    expect(fireEvent.keyDown(target, { key: "z", [modifier]: true })).toBe(true);
  }
  expect(undoManager.popForUndo).not.toHaveBeenCalled();
  unmount();
  frame.remove();
});

test("search undo and composing/handled/redo keys leave history intact; board undo still works", () => {
  const { getByPlaceholderText, container, undoManager } = setup();
  fireEvent.keyDown(getByPlaceholderText("Filter tasks..."), { key: "z", ctrlKey: true });
  const board = container.firstElementChild!;
  fireEvent.keyDown(board, { key: "z", ctrlKey: true, isComposing: true });
  fireEvent.keyDown(board, { key: "z", ctrlKey: true, shiftKey: true });
  fireEvent.keyDown(board, { key: "z", ctrlKey: true, altKey: true });
  const handled = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
  handled.preventDefault();
  fireEvent(board, handled);
  expect(undoManager.popForUndo).not.toHaveBeenCalled();
  fireEvent.keyDown(board, { key: "z", ctrlKey: true });
  expect(undoManager.popForUndo).toHaveBeenCalledTimes(1);
});

function task(path: string, text: string): TaskItem<TFile> {
  return { status: TaskStatus.Todo, text, line: 0, attributes: {}, file: { id: path, file: { path, name: "Tasks.md", basename: "Tasks" } as TFile } } as TaskItem<TFile>;
}
function listDeps() {
  const listeners = new Set<(file: TFile) => void>();
  const app = {
    metadataCache: {
      getFileCache: jest.fn(() => ({ frontmatter: { title: "Original" } })),
      on: jest.fn((_event, callback) => {
        listeners.add(callback);
        return callback;
      }),
      offref: jest.fn((ref) => listeners.delete(ref)),
    },
  } as unknown as App;
  return { app, settings: DEFAULT_SETTINGS, logger, listeners };
}

test("duplicate basenames have separate groups and separate drag payloads", () => {
  const a = task("A/Tasks.md", "Alpha"),
    b = task("B/Tasks.md", "Beta");
  const { container } = render(<TaskListComponent todos={[a, b]} deps={listDeps()} />);
  const headers = container.querySelectorAll(".group > .header");
  expect(headers).toHaveLength(2);
  headers.forEach((header, i) => {
    const setData = jest.fn();
    fireEvent.dragStart(header, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith(Consts.TaskGroupDragType, getTaskId(i ? b : a));
  });
});

test("sorting preserves frozen input and still renders alphabetical order", () => {
  const tasks = [task("A/Tasks.md", "Zulu"), { ...task("A/Tasks.md", "Alpha"), line: 1 }];
  Object.freeze(tasks);
  const { container } = render(<TaskListComponent todos={tasks} deps={listDeps()} />);
  expect(tasks.map((t) => t.text)).toEqual(["Zulu", "Alpha"]);
  expect(container.textContent!.indexOf("Alpha")).toBeLessThan(container.textContent!.indexOf("Zulu"));
});

test("500 hidden filename cards use only their group header listener and clean up", () => {
  const deps = listDeps();
  const todos = Array.from({ length: 500 }, (_, i) => ({ ...task("A/Tasks.md", `Task ${i}`), line: i }));
  const { unmount } = render(<TaskListComponent todos={todos} deps={deps} />);
  expect(deps.listeners.size).toBe(1);
  unmount();
  expect(deps.listeners.size).toBe(0);
});

test("visible filenames update and subscriptions track hide/show and unmount", () => {
  const deps = listDeps();
  const todo = task("A/Tasks.md", "Alpha");
  const { container, rerender, unmount } = render(<TodoItemComponent todo={todo} deps={deps} />);
  expect(deps.listeners.size).toBe(1);
  (deps.app.metadataCache.getFileCache as jest.Mock).mockReturnValue({ frontmatter: { title: "Changed" } });
  act(() => deps.listeners.forEach((fn) => fn(todo.file.file)));
  expect(container).toHaveTextContent("Changed");
  rerender(<TodoItemComponent todo={todo} deps={deps} hideFileRef />);
  expect(deps.listeners.size).toBe(0);
  rerender(<TodoItemComponent todo={todo} deps={deps} hideFileRef={false} />);
  expect(deps.listeners.size).toBe(1);
  expect(container).toHaveTextContent("Changed");
  unmount();
  expect(deps.listeners.size).toBe(0);
});
