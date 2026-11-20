import assert from "node:assert/strict";
import test from "node:test";
import { Linter } from "eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import config from "../eslint.config.mjs";

const ruleId = "obsidianmd/ui/sentence-case";
const rule = config.find((entry) => entry.rules?.[ruleId]).rules[ruleId];
const linter = new Linter();

function lintTitle(text) {
  return linter.verify(`contentEl.createDiv({ text: ${JSON.stringify(text)} });`, [
    { plugins: { obsidianmd }, rules: { [ruleId]: rule } },
  ]);
}

test("the tooling update preserves the existing Quick-add title without changing UI copy", () => {
  assert.deepEqual(lintTitle("Quick-add Task"), []);
});

test("the existing-title exception cannot admit other title-case text or extensions", () => {
  for (const text of ["Another Modal Title", "Quick-add Task Options", "New Quick-add Task"]) {
    const messages = lintTitle(text);
    assert.equal(messages.length, 1, text);
    assert.equal(messages[0].ruleId, ruleId, text);
    assert.equal(messages[0].severity, 2, text);
  }
});

test("sentence-case UI text remains valid", () => {
  assert.deepEqual(lintTitle("Quick-add task"), []);
  assert.deepEqual(lintTitle("Another modal title"), []);
});

test("the existing numeric-horizon exception stays narrow", () => {
  assert.deepEqual(lintTitle("2 weeks (in 3-4 weeks)"), []);
  assert.equal(lintTitle("2 Weeks (in 3-4 weeks)").length, 1);
});
