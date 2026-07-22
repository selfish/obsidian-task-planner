import { appHasDailyNotesPluginLoaded, getDailyNoteSettings as getConfiguredDailyNoteSettings } from "obsidian-daily-notes-interface";

export interface DailyNoteSettings {
  folder: string;
  format: string;
  template?: string;
}

const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";

/**
 * Adapts the community-maintained Daily Notes interface to the small shape used
 * by Task Planner. Obsidian does not expose Daily Notes settings in its public
 * API, so the dependency owns compatibility with core Daily Notes and Periodic
 * Notes internals while the rest of the plugin stays on public APIs.
 */
export function readDailyNoteSettings(): DailyNoteSettings | null {
  try {
    if (!appHasDailyNotesPluginLoaded()) {
      return null;
    }

    const settings = getConfiguredDailyNoteSettings();
    if (!settings) {
      return null;
    }

    return {
      folder: settings.folder ?? "",
      format: settings.format || DEFAULT_DAILY_NOTE_FORMAT,
      template: settings.template || undefined,
    };
  } catch {
    return null;
  }
}
