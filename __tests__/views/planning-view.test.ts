import { createRoot, Root } from "react-dom/client";

import { TFile, WorkspaceLeaf } from "obsidian";

import { TaskIndex } from "../../src/core";
import { TaskPlannerSettings } from "../../src/settings";
import { PlanningView } from "../../src/views/planning-view";

jest.mock("react-dom/client", () => ({ createRoot: jest.fn() }));

describe("PlanningView", () => {
  it("reuses its React root and unmounts it on close", async () => {
    const root = { render: jest.fn(), unmount: jest.fn() } as unknown as Root;
    jest.mocked(createRoot).mockReturnValue(root);
    const contentView = document.createElement("div") as HTMLDivElement & { addClass: (name: string) => void };
    contentView.addClass = (name) => contentView.classList.add(name);
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const view = new PlanningView({ logger, taskIndex: {} as TaskIndex<TFile> }, {} as TaskPlannerSettings, new WorkspaceLeaf());
    (view as unknown as { contentView: HTMLDivElement }).contentView = contentView;

    await view.onOpen();
    view.onShow();
    view.render();

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(root.render).toHaveBeenCalledTimes(3);

    await view.onClose();

    expect(root.unmount).toHaveBeenCalledTimes(1);

    view.render();
    expect(createRoot).toHaveBeenCalledTimes(2);
  });
});
