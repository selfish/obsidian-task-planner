import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";
import sdl from "@microsoft/eslint-plugin-sdl";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
        // Obsidian globals
        createDiv: "readonly",
        createEl: "readonly",
        createSpan: "readonly",
        createFragment: "readonly",
        activeDocument: "readonly",
        activeWindow: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
      obsidianmd,
      "@microsoft/sdl": sdl,
      import: importPlugin,
    },
    settings: {
      react: {
        version: "19",
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-prototype-builtins": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "no-console": ["error", { allow: ["warn", "error", "debug"] }],
      "prefer-const": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],

      // Obsidian-specific rules
      "obsidianmd/commands/no-command-in-command-id": "error",
      "obsidianmd/commands/no-command-in-command-name": "error",
      "obsidianmd/commands/no-default-hotkeys": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
      "obsidianmd/vault/iterate": "error",
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/hardcoded-config-path": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "obsidianmd/no-plugin-as-component": "error",
      "obsidianmd/no-sample-code": "error",
      "obsidianmd/no-tfile-tfolder-cast": "error",
      "obsidianmd/no-view-references-in-plugin": "error",
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/object-assign": "error",
      "obsidianmd/platform": "error",
      "obsidianmd/prefer-file-manager-trash-file": "warn",
      "obsidianmd/prefer-abstract-input-suggest": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/sample-names": "error",
      "obsidianmd/validate-manifest": "error",
      "obsidianmd/validate-license": "error",
      "obsidianmd/ui/sentence-case": ["error", { enforceCamelCaseLower: true }],

      // SDL rules
      "@microsoft/sdl/no-document-write": "error",
      "@microsoft/sdl/no-inner-html": "error",

      // Import rules
      "import/no-extraneous-dependencies": "error",

      // Obsidian-specific restrictions
      "no-restricted-globals": [
        "error",
        {
          name: "app",
          message: "Avoid using the global app object. Instead use the reference provided by your plugin instance.",
        },
        {
          name: "fetch",
          message: "Use the built-in `requestUrl` function instead of `fetch` for network requests in Obsidian.",
        },
        {
          name: "localStorage",
          message: "Prefer `App#saveLocalStorage` / `App#loadLocalStorage` functions to write / read localStorage data that's unique to a vault.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          name: "axios",
          message: "Use the built-in `requestUrl` function instead of `axios`.",
        },
        {
          name: "moment",
          message: "The 'moment' package is bundled with Obsidian. Please import it from 'obsidian' instead.",
        },
      ],
    },
  },
  prettier,
  {
    ignores: [
      "node_modules/",
      "main.js",
      "*.map",
      "dist/",
      "coverage/",
      "esbuild.config.mjs",
      "version-bump.mjs",
      "jest.config.js",
      "__tests__/",
    ],
  },
];
