const obsidian = require("obsidian");

const camelCase = (id) => id.replace(/-\w/g, (match) => match[1].toUpperCase());

module.exports = class TaskPlannerE2eHelper extends obsidian.Plugin {
  onload() {
    const globals = () => ({
      app: this.app,
      obsidian,
      plugins: Object.fromEntries(
        Object.entries(this.app.plugins.plugins)
          .filter(([id]) => id !== "task-planner-e2e-helper")
          .map(([id, plugin]) => [camelCase(id), plugin])
      ),
      require,
    });

    window.taskPlannerE2e = globals;
    this.registerEvent(this.app.workspace.on("window-open", ({ win }) => (win.taskPlannerE2e = globals)));
  }
};
