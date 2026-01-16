import * as React from "react";
import { PlanningSettings } from "./PlanningSettings";
import { App, setIcon } from "obsidian";

export interface PlanningSettingsComponentProps {
  setPlanningSettings: (settings: PlanningSettings) => void;
  planningSettings: PlanningSettings;
  totalTasks?: number;
  completedToday?: number;
  app?: App;
  onRefresh?: () => void;
  onOpenReport?: () => void;
}

export function PlanningSettingsComponent({ setPlanningSettings, planningSettings, totalTasks, completedToday, app, onRefresh, onOpenReport }: PlanningSettingsComponentProps) {
  const { hideEmpty, hideDone, searchParameters } = planningSettings;
  const { searchPhrase } = searchParameters;

  function onHideEmptyClicked(ev: React.ChangeEvent<HTMLInputElement>) {
    setPlanningSettings({
      ...planningSettings,
      hideEmpty: ev.target.checked,
    });
  }

  function onHideDoneClicked() {
    setPlanningSettings({
      ...planningSettings,
      hideDone: !hideDone,
    });
  }

  function onSearchChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setPlanningSettings({
      ...planningSettings,
      searchParameters: {
        ...searchParameters,
        searchPhrase: ev.target.value,
      },
    });
  }

  function onOpenSettings() {
    if (app) {
      // Access internal Obsidian API for settings
      const appWithSettings = app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } };
      appWithSettings.setting.open();
      appWithSettings.setting.openTabById("task-planner");
    }
  }

  const settingsIconRef = React.useRef<HTMLButtonElement>(null);
  const refreshIconRef = React.useRef<HTMLButtonElement>(null);
  const reportIconRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (settingsIconRef.current && app) {
      settingsIconRef.current.replaceChildren();
      setIcon(settingsIconRef.current, "settings");
    }
    if (refreshIconRef.current && app) {
      refreshIconRef.current.replaceChildren();
      setIcon(refreshIconRef.current, "refresh-cw");
    }
    if (reportIconRef.current && app) {
      reportIconRef.current.replaceChildren();
      setIcon(reportIconRef.current, "list-checks");
    }
  }, [app]);

  const completionPercent = totalTasks > 0 ? Math.round(((completedToday || 0) / totalTasks) * 100) : 0;

  return (
    <div className="header">
      <div className="title">
        <h1>Task Planner</h1>
        {(totalTasks > 0 || completedToday > 0) && (
          <div className="stats">
            <span className="stat">{completedToday || 0} done</span>
            <span className="stat separator">•</span>
            <span className="stat">{totalTasks || 0} active</span>
            <div className="progress">
              <div className="fill" style={{ "--progress-width": `${completionPercent}%` } as React.CSSProperties}></div>
            </div>
          </div>
        )}
      </div>
      <div className="controls">
        <input type="text" className="search" placeholder="Filter tasks..." onChange={onSearchChange} value={searchPhrase} />
        <label className="checkbox-label">
          <input type="checkbox" checked={hideEmpty} onChange={onHideEmptyClicked} />
          <span>Hide empty</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={hideDone} onChange={onHideDoneClicked} />
          <span>Hide done</span>
        </label>
        {onOpenReport && <button ref={reportIconRef} className="settings-btn" onClick={onOpenReport} aria-label="Open report" />}
        {onRefresh && <button ref={refreshIconRef} className="settings-btn" onClick={onRefresh} aria-label="Refresh planning board" />}
        <button ref={settingsIconRef} className="settings-btn" onClick={onOpenSettings} aria-label="Open plugin settings" />
      </div>
    </div>
  );
}
