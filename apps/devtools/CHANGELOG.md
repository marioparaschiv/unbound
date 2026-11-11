# Changelog

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/devtools-v0.3.0...devtools-v1.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Features

* **devtools:** inspect React and native views over the debugger ([#1098](https://github.com/marioparaschiv/unbound/issues/1098)) ([c03a7a9](https://github.com/marioparaschiv/unbound/commit/c03a7a96341f756e992bb5c39fbc74cb73dafb4d))


### Code Refactoring

* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))

## [0.3.0](https://github.com/marioparaschiv/unbound/compare/devtools-v0.2.0...devtools-v0.3.0) (2026-11-11)


### Features

* **devtools:** bundle ubd, add settings dialog, smooth scroll ([#1083](https://github.com/marioparaschiv/unbound/issues/1083)) ([82f9aaa](https://github.com/marioparaschiv/unbound/commit/82f9aaae9c7a2a9e8dae5f31806806f8ccb7bfe6))

## [0.2.0](https://github.com/marioparaschiv/unbound/compare/devtools-v0.1.0...devtools-v0.2.0) (2026-11-05)


### Features

* **loader:** ship the React DevTools backend as signed bytecode ([#919](https://github.com/marioparaschiv/unbound/issues/919)) ([d940256](https://github.com/marioparaschiv/unbound/commit/d940256443edfc12fb0fd5bb6ae0eb013f4aadcb))


### Code Refactoring

* **client:** remove deprecated APIs and document the SDK ([#795](https://github.com/marioparaschiv/unbound/issues/795)) ([ae90809](https://github.com/marioparaschiv/unbound/commit/ae90809cad35698c8df7e954ff283a526500fb13))

## 0.1.0 (2026-10-31)


### Features

* **devtools:** add native React DevTools app with MCP ([#333](https://github.com/marioparaschiv/unbound/issues/333)) ([7c46104](https://github.com/marioparaschiv/unbound/commit/7c46104501c3a4418926e6d66042d7ac7301bf3a))
