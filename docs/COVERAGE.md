# Coverage surfaces and gates

Task Planner publishes two **unit-instrumentation** reports. Both execute the same Jest tests; they differ only in source selection, report location and thresholds. Neither includes real-Obsidian smoke-test execution, nor proves correctness of every behavior or host integration.

| Surface | Source selection | Report directory | Required minimum: lines / statements / branches / functions |
| --- | --- | --- | --- |
| Focused-core | Historical selection in `jest.config.js` | `coverage/focused-core/` | 70 / 70 / 70 / 70% (unchanged) |
| Whole-source | All `src/**/*.{ts,tsx}`, excluding only declaration files | `coverage/whole-source/` | 78 / 78 / 75 / 73% |

“Focused-core” is a label for the existing subset, not a claim that only `src/core` is measured. It excludes the entrypoint, barrel exports, view wrappers, settings store, file adapter, open-planning/report command handlers, CodeMirror extension, TSX UI components and wikilink suggestion UI. Those runtime files are **included** in whole-source coverage, even when never imported by a test. Declaration files and compiler-erased type-only modules have no executable behavior to count.

The initial whole-source floors are rounded down from a measurement of main `7ea0700d51ce68ba7970297da6c73f9a0ee18043`: **78.99% lines, 78.40% statements, 75.94% branches, 73.95% functions** across 56 suites / 1,264 tests. This supersedes the older diagnostic measurement in issue #264; neither number is a timeless project score. Existing focused-core thresholds and required functional, audit and real-host checks remain intact.

## Reproduce and inspect

```sh
npm ci
npm run test:coverage:config
npm run test:coverage -- --runInBand
npm run test:coverage:whole -- --runInBand
```

Each directory contains `coverage-summary.json` (counts and percentages), `lcov.info`, and a browsable `index.html` / `lcov-report/index.html`. Use per-file reports to locate uncovered behaviors instead of quoting only the aggregate.

The test-only transformer normalizes ts-jest 29.4.13's `file:` source URLs into filesystem paths before Istanbul reads them. Without this, reports contain nonexistent `src/.../file:/...` paths and cannot resolve source links. Generated code, mapping positions, source contents and compiler options are preserved; unit tests cover the conversion and untouched outputs. Production compilation is unchanged.

The CI Tests job checks out the recorded PR head (or main commit), runs both surfaces, and publishes a labeled summary and `coverage-<reviewed-sha>` artifact with `revision.txt`. Check that file against the revision under review before reusing evidence. Artifacts are retained for seven days. Codecov's existing `unittests` upload remains **focused-core only**; whole-source reports are published in CI, not silently merged into that historical percentage. CI summaries and artifacts do not depend on Codecov availability.

## Ratcheting policy

Both threshold sets are blocking Jest gates, not measurement-only overrides. When new behavioral tests produce a stable gain, raise the affected whole-source floors in the same focused change and update the configuration contract tests. Do not reduce floors or add source exclusions to make a failing run pass; investigate the missing coverage. A configuration contract verifies source selection, the common test configuration and the stated thresholds.

Real-host tests remain separate because their purpose is to verify Obsidian behavior, runtime integrity and fixture-vault preservation. A passing host smoke suite does not increase a unit-instrumentation percentage. No owner smoke test is needed for these reporting-only changes.
