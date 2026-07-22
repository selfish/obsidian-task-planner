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
