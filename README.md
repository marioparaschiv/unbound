<div align="center">

<img src="https://github.com/unbound-mod/assets/blob/main/logo/logo.png?raw=true" style="border-radius: 25px" width="120" alt="Unbound logo" />

# Unbound

### A cross-platform client modification for Discord on mobile.

**Plugins. Themes. Fonts. Icon packs.** All hot-reloadable, all reversible, all running natively inside Discord on iOS and Android - giving users back control, stability, and customisation.

<br />

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg)](#platform-support)
[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-black.svg)](https://bun.sh)
[![Built with TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

[Documentation](https://docs.unbound.rip) · [Contributing](./CONTRIBUTING.md) · [Code Style](./AGENTS.md)

</div>

---

## What is Unbound?

Unbound is a **client modification** ("client mod") for the official Discord mobile app. It runs _inside_ Discord itself, alongside the app's own code, and exposes a stable, friendly way to extend and customise it. On that foundation, users can install:

- **Plugins** - add-ons that change how Discord behaves: new commands, extra UI, tweaks to existing features.
- **Themes** - colour and appearance overrides, with optional custom backgrounds.
- **Fonts** - custom font families.
- **Icon packs** - replacements for Discord's built-in icons and assets.

Because Unbound runs as part of Discord rather than as a separate program, add-ons have direct, first-class access to the app - there's no slow bridge in between. The trade-off is deliberate: Unbound is a **power-user tool**, and its safety model is built on _recoverability_ (a recovery mode, error boundaries, and guaranteed clean teardown) rather than on isolation.

> **This repository contains the client source only.** The native loaders that install Unbound into Discord (iOS / Android) live separately. To _install_ Unbound, follow the [documentation](https://docs.unbound.rip) for your platform.

---

## How it works

At a high level, Unbound sits between Discord and the add-ons a user installs:

1. A small **native loader** starts Discord and injects Unbound when the app launches.
2. Unbound **finds the pieces of Discord it needs** and wraps them in a stable, well-documented surface, so add-ons don't have to depend on Discord's ever-changing internals.
3. **Add-ons run on top of that surface.** Unbound manages their whole lifecycle - installing, enabling, disabling, and reloading them - and reports what's happening at every step.
4. **Everything is reversible.** Anything an add-on turns on can be cleanly turned off again, and Unbound can fully restore Discord to its original state. This is what makes safe hot-reloading - and recovery from a misbehaving add-on - possible.

For a deeper look at the architecture, the add-on format, the plugin SDK, and the native bridge, see the [documentation](https://docs.unbound.rip).

---

## Architecture

The repository is a **Bun workspace monorepo**. The client is the centre of gravity; the rest are focused, single-purpose packages.

| Package                                  | What it is                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`packages/client`](packages/client)     | The Unbound runtime itself. This is the bundle that ships into Discord.                                                        |
| [`packages/debugger`](packages/debugger) | A standalone REPL/CLI that connects to a running client to eval code, stream logs, and push add-on bundles during development. |
| [`packages/logger`](packages/logger)     | A tiny, dependency-free scoped logger with ANSI colourisation.                                                                 |
| [`packages/utils`](packages/utils)       | Minimal, per-file utilities, each imported individually for tree-shaking.                                                      |
| [`packages/types`](packages/types)       | Shared TypeScript types used across the project.                                                                               |
| [`packages/api`](packages/api)           | Generated public type declarations consumed by plugin developers.                                                              |

### Design principles

- **Hot-reloadable by contract.** Every part of the system can be cleanly torn down. No orphaned changes, no leaked listeners.
- **Lazy everything.** Work is deferred until it's actually needed, so nothing blocks startup.
- **Error isolation.** A failing add-on is caught, logged, and recorded - it never takes the rest of Unbound (or Discord) down with it.
- **Event-driven.** State changes emit events; the UI reacts to them instead of being wired together by hand.
- **Type-safe.** A strong type system keeps the developer-facing surface predictable.

> The full, enforced coding standard lives in [`AGENTS.md`](./AGENTS.md) (backed by `oxfmt`, `oxlint`, and `ast-grep` rules).

---

## Getting started (development)

> Prerequisites: [Bun](https://bun.sh). You also need an existing Unbound installation on a device/emulator to load your local bundle into - see the [documentation](https://docs.unbound.rip).

```bash
# Clone and enter the client package
git clone https://github.com/marioparaschiv/unbound
cd client/packages/client

# Install workspace dependencies (from the repo root or here)
bun install

# Build the bundle once…
bun run build

# …or rebuild automatically on every change
bun run dev
```

**Serve the built bundle** to your device over the local network:

```bash
bun serve [PORT]    # serves ./dist; no need to cd into it
```

Then point your Unbound installation's custom bundle URL at your machine and restart Discord. See the [documentation](https://docs.unbound.rip) for the exact steps.

### Repo-wide scripts (from the root)

```bash
bun run lint         # oxlint
bun run lint:fix     # oxlint --fix-dangerously
bun run fmt          # oxfmt (write)
bun run fmt:check    # oxfmt (verify)
```

---

## Platform support

| Platform    | Status    |
| ----------- | --------- |
| **iOS**     | Primary   |
| **Android** | Supported |

Unbound talks to both platforms through a single native bridge that degrades gracefully, so the client behaves the same everywhere without special-casing. See the [documentation](https://docs.unbound.rip) for platform specifics.

---

## Contributing

Contributions are welcome. Before opening a PR:

- Read the [contribution guide](./CONTRIBUTING.md) and the [code style](./AGENTS.md) - formatting and lint rules are enforced.
- Keep PRs focused, write clear commit messages, and make sure the project at least **builds**.
- Stay current with `main`.

---

## License

Unbound is licensed under the [GNU General Public License v3.0](./LICENSE).
