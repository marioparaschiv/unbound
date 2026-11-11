# Changelog

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
