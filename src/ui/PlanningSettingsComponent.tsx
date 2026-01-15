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
}

export function PlanningSettingsComponent({ setPlanningSettings, planningSettings, totalTasks, completedToday, app, onRefresh }: PlanningSettingsComponentProps) {
  let { hideEmpty, hideDone } = planningSettings;
  const { searchParameters } = planningSettings;
  let { searchPhrase, fuzzySearch } = searchParameters;

  function saveSettings() {
    setPlanningSettings({
      hideEmpty,
      hideDone,
      searchParameters: {
        fuzzySearch,
        searchPhrase,
      },
      wipLimit: planningSettings.wipLimit,
    });
  }

  function onHideEmptyClicked(ev: React.ChangeEvent<HTMLInputElement>) {
    hideEmpty = ev.target.checked;
    saveSettings();
  }

  function onHideDoneClicked(ev: React.ChangeEvent<HTMLInputElement>) {
    hideDone = ev.target.checked;
    saveSettings();
  }

  function onFuzzyClicked(ev: React.ChangeEvent<HTMLInputElement>) {
    fuzzySearch = ev.target.checked;
    saveSettings();
  }

  function onSearchChange(ev: React.ChangeEvent<HTMLInputElement>) {
    searchPhrase = ev.target.value;
    saveSettings();
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

  React.useEffect(() => {
    if (settingsIconRef.current && app) {
      settingsIconRef.current.replaceChildren();
      setIcon(settingsIconRef.current, "settings");
    }
    if (refreshIconRef.current && app) {
      refreshIconRef.current.replaceChildren();
      setIcon(refreshIconRef.current, "refresh-cw");
    }
  }, [app]);

  const completionPercent = totalTasks > 0 ? Math.round(((completedToday || 0) / totalTasks) * 100) : 0;

  return (
    <div className="th-header">
      <div className="th-header-title">
        <h1>Task Planner</h1>
        {(totalTasks > 0 || completedToday > 0) && (
          <div className="th-header-stats">
            <span className="th-stat">{completedToday || 0} done</span>
            <span className="th-stat-separator">•</span>
            <span className="th-stat">{totalTasks || 0} active</span>
            <div className="th-progress-bar">
              <div className="th-progress-fill" style={{ "--progress-width": `${completionPercent}%` } as React.CSSProperties}></div>
            </div>
          </div>
        )}
      </div>
      <div className="th-header-controls">
        <input type="text" className="th-search-input" placeholder="Filter tasks..." onChange={onSearchChange} value={searchPhrase} />
        <label className="th-checkbox-label">
          <input type="checkbox" checked={fuzzySearch} onChange={onFuzzyClicked} />
          <span>Fuzzy</span>
        </label>
        <label className="th-checkbox-label">
          <input type="checkbox" checked={hideEmpty} onChange={onHideEmptyClicked} />
          <span>Hide empty</span>
        </label>
        <label className="th-checkbox-label">
          <input type="checkbox" checked={hideDone} onChange={onHideDoneClicked} />
          <span>Hide done</span>
        </label>
        {onRefresh && <button ref={refreshIconRef} className="th-settings-button" onClick={onRefresh} aria-label="Refresh planning board" />}
        <button ref={settingsIconRef} className="th-settings-button" onClick={onOpenSettings} aria-label="Open plugin settings" />
      </div>
    </div>
  );
}
