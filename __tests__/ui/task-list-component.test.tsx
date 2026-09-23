import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { App, TFile } from "obsidian";

import { DEFAULT_SETTINGS } from "../../src/settings/types";
import { groupTodosByFile, sortTodos, TaskListComponent } from "../../src/ui/task-list-component";
import { TaskItem, TaskStatus } from "../../src/types/task";
import { Consts } from "../../src/types/constants";

function task(path: string, text: string, status = TaskStatus.Todo, priority?: string): TaskItem<TFile> {
  const file = new TFile(path);
  return {
    status,
    text,
    line: 0,
    attributes: priority ? { priority } : {},
    file: {
      id: path,
      path,
      name: file.name,
      file,
      getContent: jest.fn(),
      setContent: jest.fn(),
      createOrSave: jest.fn(),
      isInFolder: jest.fn(() => false),
      shouldIgnore: jest.fn(() => false),
    },
  };
}

describe("TaskListComponent", () => {
  beforeAll(() => {
    const elementPrototype = HTMLElement.prototype as HTMLElement & { empty?: () => void };
    elementPrototype.empty = function (this: HTMLElement) {
      this.replaceChildren();
    };
  });

  it("keeps same-named notes in different folders as separate groups", () => {
    const first = task("A/Tasks.md", "First");
    const second = task("B/Tasks.md", "Second");

    const groups = groupTodosByFile([first, second]);

    expect([...groups.keys()]).toEqual(["A/Tasks.md", "B/Tasks.md"]);
    expect([...groups.values()]).toEqual([[first], [second]]);
  });

  it("limits same-named group drag payloads to the selected note", () => {
    const app = new App();
    const first = task("A/Tasks.md", "First");
    const second = task("B/Tasks.md", "Second");
    const { container } = render(
      <TaskListComponent
        todos={[first, second]}
        deps={{
          app,
          settings: DEFAULT_SETTINGS,
          logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        }}
      />
    );
    const setData = jest.fn();

    fireEvent.dragStart(container.querySelectorAll(".group .header")[0], { dataTransfer: { setData } });

    expect(setData).toHaveBeenCalledWith(Consts.TaskGroupDragType, "A/Tasks.md-0-First");
  });

  it("sorts a copy without changing the incoming task array", () => {
    const low = task("Tasks.md", "Zulu", TaskStatus.Todo, "low");
    const high = task("Tasks.md", "Alpha", TaskStatus.Todo, "high");
    const incoming = Object.freeze([low, high]) as unknown as TaskItem<TFile>[];

    const sorted = sortTodos(incoming);

    expect(sorted).toEqual([high, low]);
    expect(incoming).toEqual([low, high]);
    expect(sorted).not.toBe(incoming);
  });

  it("subscribes once per visible group, not once per hidden card, and cleans up", () => {
    const app = new App();
    const tasks = [task("A/Tasks.md", "First"), task("A/Tasks.md", "Second"), task("B/Tasks.md", "Third")];
    const { unmount } = render(
      <TaskListComponent
        todos={tasks}
        deps={{
          app,
          settings: DEFAULT_SETTINGS,
          logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        }}
      />
    );

    expect(app.metadataCache.on).toHaveBeenCalledTimes(2);
    unmount();
    expect(app.metadataCache.offref).toHaveBeenCalledTimes(2);
  });
});
