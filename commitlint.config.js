module.exports = {
  extends: ["@commitlint/config-conventional"],
  // Ignore version commits from the npm version
  ignores: [(message) => /^\d+\.\d+\.\d+$/.test(message)],
  rules: {
    // Type must be one of these
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation
        "style", // Formatting, no code change
        "refactor", // Code restructuring
        "perf", // Performance improvement
        "test", // Adding tests
        "build", // Build system or dependencies
        "ci", // CI configuration
        "chore", // Maintenance
        "revert", // Revert a previous commit
      ],
    ],
    // Keep the subject concise
    "subject-max-length": [2, "always", 72],
    // No period at the end of a subject
    "subject-full-stop": [2, "never", "."],
  },
};
