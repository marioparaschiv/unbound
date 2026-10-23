# apps/web verification map

This directory is the maintained source for verifying the user-facing behavior of unbound.rip (`apps/web`). Read the index, then use the matching feature file as the recipe. Commands are relative to `.agents/skills/verify-web/`.

## Baseline preconditions

- `scripts/launch.sh` printed `ready: <URL>`, and `scripts/doctor.sh` exits 0.
- The seed from SKILL.md is untouched. If an earlier journey mutated it, run `scripts/teardown.sh && scripts/launch.sh`.
- Drive only an instance this run launched.

## Driving conventions

- Use T3 preview tools in your own tab (`reuseExistingTab: false`) and pass its `tabId` on every call.
- Sign in with `preview_evaluate` and the output of `scripts/session.sh <role>`.
- Target controls by role and accessible name (`role=button[name='Approve']`), not by CSS or coordinates.

## Proof and skip reporting

- Capture the action and the resulting state. That means a recording or before and after snapshots.
- Prove every mutation with a second, read-only view: the DB row, the CDN object or an API response.
- If an entry point is unreachable, report the attempt and the unmet precondition. Never report it as verified through another path.

## Feature entry contract

Each file has an H1, one paragraph, then four H2s in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with preview tools`, `Gotchas`.

## Features

| Feature                                                                                                | Status                                                          |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [Review queue](./review-queue.md) covers approve, reject and request changes as a moderator.           | Approve was driven end to end on 2026-10-23.                    |
| [Browse addons](./browse.md) covers the home page, the plugins and themes lists, search and sort.      | Pages render with the seed. Search and sort are not yet driven. |
| [Addon detail](./addon-detail.md) covers the detail page and the install link.                         | The page renders with the seed. Install is not yet driven.      |
| [Submit an addon](./submit.md) covers the manifest and bundle upload to review.                        | Not yet driven.                                                 |
| [Dashboard and staff gates](./dashboard.md) covers per-role access, the dashboard and the admin pages. | Signed-out redirects and the moderator dashboard were observed. |
