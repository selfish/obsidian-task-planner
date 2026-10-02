# Security Policy

## Supported versions

Task Planner provides security fixes on the latest release in the current major line.

| Version | Security updates |
| --- | --- |
| Latest 2.x release | Supported |
| Earlier 2.x releases | Upgrade to the latest 2.x release; existing settings and vault formats remain backward-compatible |
| 1.x and earlier | Not supported |

## Reporting a vulnerability

Please **do not** disclose a suspected vulnerability in a public issue, pull request, or discussion.

1. If GitHub shows **Report a vulnerability** on the repository's Security page, use that private form.
2. If the private form is unavailable, open a GitHub Discussion titled `Security contact request` with no technical details, proof of concept, affected vault data, or secrets. A maintainer will arrange a private channel.

Include the affected version, impact, reproduction steps, and any suggested mitigation only in the private report.

The project aims to acknowledge a complete report within seven days. Timing for validation and a fix depends on severity and complexity. We will coordinate disclosure with the reporter and credit them unless they prefer to remain anonymous.

## Scope

Security reports may include:

- unintended modification, deletion, or disclosure of vault content;
- command, link, or Markdown handling that crosses Obsidian's expected trust boundaries;
- vulnerable runtime or release artifacts;
- compromised build, CI, dependency, or release workflows.

General bugs, compatibility requests, and feature proposals belong in the public issue tracker.

## Code scanning and maintainer triage

The `CodeQL` workflow analyzes JavaScript/TypeScript (plugin, tests, and repository tooling) and GitHub Actions workflows with the `security-extended` query suite. It runs on pull requests to `main`, pushes to `main`, or manual dispatch; there is no additional scheduled job. It does not install dependencies, run repository build scripts, or access a real vault. npm audit and functional/runtime CI remain separate checks.

Actions are pinned to release commits. The existing weekly GitHub Actions Dependabot configuration proposes minor/patch updates as a group; major updates remain separate review work. SHA pins do not themselves receive Dependabot vulnerability alerts, so urgent action updates still need maintainer attention.

A successful analysis means the scan completed and its results were uploaded, **not** that the plugin is vulnerability-free or that every alert is fixed. CodeQL job checks are not newly required by branch protection in this change. Maintainers must inspect the alerts and the SHA-bound SARIF artifacts before merging scan-related changes; fork-PR uploads use GitHub's restricted code-scanning handling, not elevated `pull_request_target` credentials.

For each new finding:

1. Confirm the analyzed revision and language category. Reproduce or trace the reported source-to-sink path in current code; distinguish production vault/link/command exposure from tests and build/release tooling. Tooling findings can still affect the release chain.
2. Treat a confirmed critical/high security finding, credential exposure, or destructive vault path as blocking affected work. Follow the private reporting process above for exploitable vulnerabilities; do not publish exploit details in an ordinary issue or PR.
3. For a non-sensitive lower-risk finding, reuse the relevant issue/PR or create one only for independently managed remediation. Record the rule, affected path, impact, next action and regression evidence. An unchanged warning is not a reason to freeze unrelated safe work, but must not be silently dismissed.
4. Dismiss only after documenting why the specific path is a false positive, test-only/non-reachable, or an explicitly accepted risk, using the matching GitHub dismissal reason. Do not suppress a query or exclude a directory merely to obtain a green badge.
5. Verify the fix with a new analysis of the candidate and then merged `main`. Retain the functional, audit and host checks relevant to the change; a static scan does not establish round-trip correctness or ecosystem compatibility.

The seven-day workflow artifacts contain the SARIF results and `revision.txt`, matching their named reviewed SHA. Download them before relying on exact-head evidence. Code scanning also retains processed analyses in GitHub's Security tab. Coverage, the known development-only audit exception, release approval, and installation into a real vault are not changed by this workflow.

Configuration and permission behavior follow [GitHub's CodeQL workflow documentation](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options).
