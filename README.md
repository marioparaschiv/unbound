<div align="center">

<img src="./assets/logo.png" width="120" alt="Unbound logo" />

# Unbound

### A cross-platform client modification for Discord on mobile.

**Plugins · Themes · Fonts · Icon packs** — make Discord yours, with hot-reloadable add-ons running natively on iOS and Android.

<br />

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg)](#platform-support)
[![Built with TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

**[Documentation](https://docs.unbound.rip)** · [Contributing](./CONTRIBUTING.md) · [Code Style](./AGENTS.md)

</div>

---

## What is Unbound?

Unbound is a **client modification** for the official Discord mobile app. It runs _inside_ Discord, wraps the app's ever-changing internals in a stable API, and lets users install **plugins**, **themes**, **fonts**, and **icon packs** on top of it.

Because it runs as part of Discord rather than alongside it, add-ons get direct, first-class access to the app. The trade-off is deliberate: Unbound is a **power-user tool**, and its safety model is built on _recoverability_ — error boundaries, a recovery mode, and guaranteed clean teardown — so anything an add-on turns on can always be cleanly turned off, and Discord restored to its original state. That same contract is what makes **safe hot-reloading** possible.

> **This repository is the client source only.** The native loaders that install Unbound into Discord live separately. To _install_ Unbound, follow the [documentation](https://docs.unbound.rip) for your platform.

---

## Creating add-ons

Every add-on shares one [manifest format](https://docs.unbound.rip) and a `type` that tells the client what to do with it:

- **Plugins** — change how Discord behaves: commands, UI, patches. Built against the typed [`@unbound-app/api`](packages/api) SDK, with a `start()` / `stop()` lifecycle the client manages for you.
- **Themes** — semantic and raw color overrides, with optional custom backgrounds.
- **Fonts** — custom font families, registered natively.
- **Icon packs** — drop-in replacements for Discord's built-in assets.

Plugin developers install `@unbound-app/api` for fully-typed, autocompleted access to the entire client API (`unbound.metro`, `unbound.storage`, `unbound.toasts`, and more). **Start with the [add-on developer documentation](https://docs.unbound.rip)** — it covers the manifest, the lifecycle, the SDK, and publishing to the marketplace end-to-end.

---

## Architecture

A **Bun workspace monorepo**. The client is the center of gravity; everything else is a focused, single-purpose package.

| Package                                  | What it is                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`packages/client`](packages/client)     | The Unbound runtime — the bundle that ships into Discord.                                                                      |
| [`packages/debugger`](packages/debugger) | A standalone REPL/CLI that connects to a running client to eval code, stream logs, and push add-on bundles during development. |
| [`packages/api`](packages/api)           | Generated public type declarations consumed by add-on developers.                                                              |
| [`packages/logger`](packages/logger)     | A tiny, dependency-free scoped logger with ANSI colorization.                                                                  |
| [`packages/utils`](packages/utils)       | Minimal per-file utilities, each imported individually for tree-shaking.                                                       |
| [`packages/types`](packages/types)       | Shared TypeScript types used across the project.                                                                               |

The client is **hot-reloadable by contract** (everything tears down cleanly), **lazy** (work is deferred until needed), **error-isolated** (a failing add-on is caught and recorded, never fatal), and **event-driven**. The full, tool-enforced coding standard lives in [`AGENTS.md`](./AGENTS.md).

---

## Getting started

> **Prerequisites:** [Bun](https://bun.sh), plus an existing Unbound installation on a device or emulator to load your bundle into — see the [documentation](https://docs.unbound.rip).

```bash
git clone https://github.com/marioparaschiv/unbound
cd unbound

bun install        # install workspace dependencies
bun run build      # build the bundle once…
bun run dev        # …or rebuild automatically on every change
```

> `build`, `build:dev`, `dev`, and `serve` are defined in `packages/client`. Run them from there, or from the repo root with `bun --filter @unbound-app/client run <script>`.

**Serve the built bundle** to your device over the local network, then point your Unbound installation's custom bundle URL at your machine and restart Discord ([exact steps](https://docs.unbound.rip)):

```bash
bun serve [PORT]   # serves ./dist; no need to cd into it
```

Repo-wide checks from the root:

```bash
bun run lint       # oxlint
bun run fmt        # oxfmt (write); fmt:check to verify
```

---

## Platform support

| Platform    | Status    |
| ----------- | --------- |
| **iOS**     | Primary   |
| **Android** | Supported |

Both platforms are reached through a single native bridge that degrades gracefully, so the client behaves the same everywhere without special-casing.

---

## Contributing

Contributions are welcome. Before opening a PR, read the [contribution guide](./CONTRIBUTING.md) and the [code style](./AGENTS.md) — formatting and lint rules are enforced. Keep PRs focused, write clear commit messages, make sure the project at least **builds**, and stay current with `main`.

---

## License

Unbound is licensed under the [GNU General Public License v3.0](./LICENSE).
