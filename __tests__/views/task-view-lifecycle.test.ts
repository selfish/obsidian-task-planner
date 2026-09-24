import { createRoot, Root } from "react-dom/client";

import { TFile, WorkspaceLeaf } from "obsidian";

import { TaskIndex } from "../../src/core";
import { TaskPlannerSettings } from "../../src/settings";
import { TodoListView } from "../../src/views/task-list-view";
import { TodoReportView } from "../../src/views/task-report-view";

jest.mock("react-dom/client", () => ({ createRoot: jest.fn() }));

function prepareContainer(view: { containerEl: HTMLElement }): void {
  view.containerEl.addClass = (name: string) => view.containerEl.classList.add(name);
}

function createMockRoot(): Root {
  return { render: jest.fn(), unmount: jest.fn() } as unknown as Root;
}

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe("task view lifecycle", () => {
  it("reuses and releases the report root across refresh and close", async () => {
    const firstRoot = createMockRoot();
    const secondRoot = createMockRoot();
    jest.mocked(createRoot).mockReturnValueOnce(firstRoot).mockReturnValueOnce(secondRoot);
    const view = new TodoReportView(
      new WorkspaceLeaf(),
      { logger, taskIndex: {} as TaskIndex<TFile>, app: {} as never, settings: {} as TaskPlannerSettings },
      {} as TaskPlannerSettings
    );
    prepareContainer(view);

    await view.onOpen();
    view.render();
    view.render();

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(firstRoot.render).toHaveBeenCalledTimes(3);

    await view.onClose();
    await view.onClose();

    expect(firstRoot.unmount).toHaveBeenCalledTimes(1);

    view.render();
    expect(createRoot).toHaveBeenCalledTimes(2);
    expect(secondRoot.render).toHaveBeenCalledTimes(1);
  });

  it("reuses and releases the Today focus root across refresh and close", async () => {
    const firstRoot = createMockRoot();
    const secondRoot = createMockRoot();
    jest.mocked(createRoot).mockReturnValueOnce(firstRoot).mockReturnValueOnce(secondRoot);
    const view = new TodoListView(
      new WorkspaceLeaf(),
      { logger },
      {} as TaskIndex<TFile>,
      {} as TaskPlannerSettings
    );
    prepareContainer(view);

    view.render();
    view.render();
    view.render();

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(firstRoot.render).toHaveBeenCalledTimes(3);

    await view.onClose();
    await view.onClose();

    expect(firstRoot.unmount).toHaveBeenCalledTimes(1);

    view.render();
    expect(createRoot).toHaveBeenCalledTimes(2);
    expect(secondRoot.render).toHaveBeenCalledTimes(1);
  });
});
