import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PlanningSettingsComponent } from "../../src/ui/planning-settings-component";
import { getDefaultSettings } from "../../src/ui/planning-settings";

describe("PlanningSettingsComponent", () => {
  it("keeps the settings affordance without accessing private Obsidian APIs", () => {
    const onOpenSettings = jest.fn();

    render(<PlanningSettingsComponent planningSettings={getDefaultSettings()} setPlanningSettings={jest.fn()} showIgnored={false} setShowIgnored={jest.fn()} onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole("button", { name: "Task Planner settings" }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
