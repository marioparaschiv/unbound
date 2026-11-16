# Changelog

## [3.0.4](https://github.com/marioparaschiv/unbound/compare/rollup-plugin-hermes-v3.0.3...rollup-plugin-hermes-v3.0.4) (2026-11-16)


### Bug Fixes

* **client:** clear main's lint errors and regenerate the SDK ([#1605](https://github.com/marioparaschiv/unbound/issues/1605)) ([c9ad7f5](https://github.com/marioparaschiv/unbound/commit/c9ad7f5feef538f78b044ed374a51571d29ce0d8))

## [3.0.3](https://github.com/marioparaschiv/unbound/compare/rollup-plugin-hermes-v3.0.2...rollup-plugin-hermes-v3.0.3) (2026-11-15)


### Bug Fixes

* **rollup-plugin-hermes:** give each build its own temp folder ([#1529](https://github.com/marioparaschiv/unbound/issues/1529)) ([497b32d](https://github.com/marioparaschiv/unbound/commit/497b32dea2ed506bccd895ae8099b11805d5bb28))

## [3.0.2](https://github.com/marioparaschiv/unbound/compare/rollup-plugin-hermes-v3.0.1...rollup-plugin-hermes-v3.0.2) (2026-11-15)


### Bug Fixes

* **loader:** keep the running bundle, overlap first download ([#1513](https://github.com/marioparaschiv/unbound/issues/1513)) ([2457330](https://github.com/marioparaschiv/unbound/commit/2457330abb67f4e0ab1739d6ceb57fcc1f1707d4))

## [3.0.1](https://github.com/marioparaschiv/unbound/compare/rollup-plugin-hermes-v3.0.0...rollup-plugin-hermes-v3.0.1) (2026-11-14)


### Build System

* **deps:** bump the minor-and-patch group with 27 updates ([#1209](https://github.com/marioparaschiv/unbound/issues/1209)) ([4cb51d9](https://github.com/marioparaschiv/unbound/commit/4cb51d94289c9fffbed94fc97d0988326d828118))

## [3.0.0](https://github.com/marioparaschiv/unbound/compare/rollup-plugin-hermes-v2.0.0...rollup-plugin-hermes-v3.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Code Refactoring

* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))

## [2.0.0](https://github.com/marioparaschiv/unbound/compare/rollup-plugin-hermes-v1.3.0...rollup-plugin-hermes-v2.0.0) (2026-11-05)


### ⚠ BREAKING CHANGES

* **rollup-plugin-hermes:** the plugin is ESM-only, `manifestUrl` is now `registryUrl`, and the manifest helpers moved from dist/manifest.js to the `./manifest` export.

### Features

* **rollup-plugin-hermes:** move hermes tooling into the repo ([#957](https://github.com/marioparaschiv/unbound/issues/957)) ([b91ec1e](https://github.com/marioparaschiv/unbound/commit/b91ec1e283e51ddf94a5296872181856e68655b8))
