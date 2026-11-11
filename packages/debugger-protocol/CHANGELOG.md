# Changelog

## [2.0.0](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v1.0.2...debugger-protocol-v2.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* plugins.entities is plugins.addons, FontEntity is Font, NativePlugin* types and errors are NativeBridge* (NativePluginRuntimeBridge is LoaderNativeBridge), NATIVE_PLUGIN_* constants are NATIVE_BRIDGE_*, the manifest's minNativePluginApi is minNativeBridgeApi, and CORE_SETTINGS_STORE, SYNC_STORE and SettingsStores are CORE_BUCKET, SYNC_BUCKET and SettingsByBucket.
* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Features

* **devtools:** inspect React and native views over the debugger ([#1098](https://github.com/marioparaschiv/unbound/issues/1098)) ([c03a7a9](https://github.com/marioparaschiv/unbound/commit/c03a7a96341f756e992bb5c39fbc74cb73dafb4d))


### Code Refactoring

* finish the plugin shape and glossary renames ([#1099](https://github.com/marioparaschiv/unbound/issues/1099)) ([81ffa53](https://github.com/marioparaschiv/unbound/commit/81ffa5324f4b350cb34a9f34d84f25259f4e6d35))
* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 1.0.0

## [1.0.2](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v1.0.1...debugger-protocol-v1.0.2) (2026-11-11)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.15.0

## [1.0.1](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v1.0.0...debugger-protocol-v1.0.1) (2026-11-11)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.14.0

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v0.11.1...debugger-protocol-v1.0.0) (2026-11-10)


### ⚠ BREAKING CHANGES

* **cli:** root commands such as `ubd eval`, `ubd push`, `ubd install` and `ubd login` now live under groups (`ubd debug eval`, `ubd device install`, `ubd auth login`); `i18n` flags became subcommands; MCP tools `install` and `device` became `device_install`, `device_reset`, `device_save`, `device_restore` and `device_snapshots`.

### Code Refactoring

* **cli:** group commands under debug, device, i18n and auth ([#1065](https://github.com/marioparaschiv/unbound/issues/1065)) ([122791d](https://github.com/marioparaschiv/unbound/commit/122791ddec70095a679380c5a48dfe6419dba939))

## [0.11.1](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v0.11.0...debugger-protocol-v0.11.1) (2026-11-09)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.13.1

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v0.10.0...debugger-protocol-v0.11.0) (2026-11-09)


### Features

* **themes:** add Rosie themes, a theme maker and theme hot reload ([#985](https://github.com/marioparaschiv/unbound/issues/985)) ([0c926db](https://github.com/marioparaschiv/unbound/commit/0c926dbc03587960ac2d16f16cdd78fd07abfc5e))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.13.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v0.9.1...debugger-protocol-v0.10.0) (2026-11-05)


### Features

* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))


### Build System

* **deps:** bump @babel/plugin-syntax-jsx from 7.29.7 to 8.0.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump @babel/preset-typescript from 7.29.7 to 8.0.7 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump postgres from 3.4.9 to 4.0.0 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump the minor-and-patch group with 5 updates ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Continuous Integration

* **deps:** bump gradle/actions/setup-gradle to 6.4.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.12.0

## [0.9.1](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v0.9.0...debugger-protocol-v0.9.1) (2026-10-31)


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.11.0

## [0.9.0](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v0.8.1...debugger-protocol-v0.9.0) (2026-10-29)


### Features

* **cli:** add ubd status and ubd bridge restart ([#413](https://github.com/marioparaschiv/unbound/issues/413)) ([ca2a235](https://github.com/marioparaschiv/unbound/commit/ca2a235a73f37f6425fc91dfb6a2dd9dc953805d))
* **cli:** device tooling for install, eval and discord-apk ([b394139](https://github.com/marioparaschiv/unbound/commit/b3941395ea031958504e3530bd0747465a6c1a1f))
* **cli:** push compiled bytecode with a plugin ([#425](https://github.com/marioparaschiv/unbound/issues/425)) ([87624bb](https://github.com/marioparaschiv/unbound/commit/87624bb81463b9eb529c82cca3dda1fef8b9b581))
* **debugger:** let eval callers choose the timeout ([0ce5a66](https://github.com/marioparaschiv/unbound/commit/0ce5a66664e4086087c1d5371bb8e8f4fc676e0d))
* **debugger:** timestamp the bridge log and name the connected device ([#401](https://github.com/marioparaschiv/unbound/issues/401)) ([61ba33f](https://github.com/marioparaschiv/unbound/commit/61ba33f333f939dac9e8c0f98c40d2b468a2c604))


### Bug Fixes

* **debugger:** reject malformed device frames instead of crashing ([a725efe](https://github.com/marioparaschiv/unbound/commit/a725efef5d8967a4719cfbd1cd3c1ee8ec49d9d1))
* **debugger:** reject malformed device frames instead of crashing ([202e671](https://github.com/marioparaschiv/unbound/commit/202e6718b301053b5f6bc5c0148d6d63b1a5be85))


### Build System

* **deps:** bump tsdown ([e5cbf89](https://github.com/marioparaschiv/unbound/commit/e5cbf8969f698875d454d12b5d0250764ae9154c))
* **deps:** merge the open Dependabot updates ([cab317a](https://github.com/marioparaschiv/unbound/commit/cab317a1c8e962de4a197f298c42296b6a2afb8d))
* **deps:** merge tsdown 0.23.2 and block scoping 8 ([463b6c4](https://github.com/marioparaschiv/unbound/commit/463b6c478ea512a73b685275d03582758f362a6c))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.10.0

## [0.8.1](https://github.com/marioparaschiv/unbound/compare/debugger-protocol-v0.8.0...debugger-protocol-v0.8.1) (2026-10-25)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @unbound-app/types bumped to 0.9.0
