# Changelog

## [1.2.0](https://github.com/marioparaschiv/unbound/compare/devtools-v1.1.0...devtools-v1.2.0) (2026-11-14)


### Features

* **devtools:** mcp button on every page and base ui popouts ([#1392](https://github.com/marioparaschiv/unbound/issues/1392)) ([aed8af8](https://github.com/marioparaschiv/unbound/commit/aed8af8722f886209cc4455a52ef6e358780accb))

## [1.1.0](https://github.com/marioparaschiv/unbound/compare/devtools-v1.0.0...devtools-v1.1.0) (2026-11-14)


### Features

* **client:** open the store page from addon install links ([#1312](https://github.com/marioparaschiv/unbound/issues/1312)) ([1e34e63](https://github.com/marioparaschiv/unbound/commit/1e34e63a0fc664f808646b81d66fefba8b45f8b2))
* **devtools:** add a Metro page to browse, load and search modules ([#1273](https://github.com/marioparaschiv/unbound/issues/1273)) ([2e9eb6b](https://github.com/marioparaschiv/unbound/commit/2e9eb6b6d76577a9539b30040aa73ad0e58b5897))
* **devtools:** add an object explorer and structured ubd errors ([#1206](https://github.com/marioparaschiv/unbound/issues/1206)) ([cf37e2b](https://github.com/marioparaschiv/unbound/commit/cf37e2beccf364eb3d4a22842d5c1538c8a5c683))
* **devtools:** build for Intel Macs ([#1385](https://github.com/marioparaschiv/unbound/issues/1385)) ([9d928ea](https://github.com/marioparaschiv/unbound/commit/9d928ea3cb9ffc3611add9ae9db66db96d23c89d))
* **devtools:** find the bridge over Bonjour and add MCP to agents ([#1309](https://github.com/marioparaschiv/unbound/issues/1309)) ([03f4c20](https://github.com/marioparaschiv/unbound/commit/03f4c2016c7064fabb25c853ea766f0f1f9c962d))
* **devtools:** ship macOS as an .app, explain updates on the install page ([#1337](https://github.com/marioparaschiv/unbound/issues/1337)) ([04bc525](https://github.com/marioparaschiv/unbound/commit/04bc5258661988a4d8601ff4ec41dc914c29f72b))
* **devtools:** update the app in place and list its downloads ([#1325](https://github.com/marioparaschiv/unbound/issues/1325)) ([0848279](https://github.com/marioparaschiv/unbound/commit/084827906167b0991b86104dfa376b244e4e238f))


### Bug Fixes

* **web:** describe everything DevTools does ([#1382](https://github.com/marioparaschiv/unbound/issues/1382)) ([e3e31f7](https://github.com/marioparaschiv/unbound/commit/e3e31f7a07ebb676047f450ef6ea85bd1bf70af4))

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
