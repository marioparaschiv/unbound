# Changelog

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/debugger-v0.10.5...debugger-v1.0.0) (2026-11-11)


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
  * dependencies
    * @unbound-app/debugger-protocol bumped to 2.0.0

## [0.10.5](https://github.com/marioparaschiv/unbound/compare/debugger-v0.10.4...debugger-v0.10.5) (2026-11-11)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 1.0.2

## [0.10.4](https://github.com/marioparaschiv/unbound/compare/debugger-v0.10.3...debugger-v0.10.4) (2026-11-11)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 1.0.1

## [0.10.3](https://github.com/marioparaschiv/unbound/compare/debugger-v0.10.2...debugger-v0.10.3) (2026-11-10)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 1.0.0

## [0.10.2](https://github.com/marioparaschiv/unbound/compare/debugger-v0.10.1...debugger-v0.10.2) (2026-11-09)


### Bug Fixes

* **cli:** make the published CLI scaffold, build and bridge ([#1031](https://github.com/marioparaschiv/unbound/issues/1031)) ([312690e](https://github.com/marioparaschiv/unbound/commit/312690e035a0158fb45ee8914701832ffabc77fd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.11.1

## [0.10.1](https://github.com/marioparaschiv/unbound/compare/debugger-v0.10.0...debugger-v0.10.1) (2026-11-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.11.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/debugger-v0.9.1...debugger-v0.10.0) (2026-11-05)


### Features

* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))


### Build System

* **deps:** bump @babel/plugin-syntax-jsx from 7.29.7 to 8.0.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump @babel/preset-typescript from 7.29.7 to 8.0.7 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump postgres from 3.4.9 to 4.0.0 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))
* **deps:** bump the minor-and-patch group with 5 updates ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Continuous Integration

* **deps:** bump gradle/actions/setup-gradle to 6.4.1 ([513bfab](https://github.com/marioparaschiv/unbound/commit/513bfab33593678c1cc0ea80c55658e0280e3942))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.10.0

## [0.9.1](https://github.com/marioparaschiv/unbound/compare/debugger-v0.9.0...debugger-v0.9.1) (2026-10-31)


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.9.1

## [0.9.0](https://github.com/marioparaschiv/unbound/compare/debugger-v0.8.1...debugger-v0.9.0) (2026-10-29)


### Features

* **cli:** device tooling for install, eval and discord-apk ([b394139](https://github.com/marioparaschiv/unbound/commit/b3941395ea031958504e3530bd0747465a6c1a1f))
* **debugger:** let eval callers choose the timeout ([0ce5a66](https://github.com/marioparaschiv/unbound/commit/0ce5a66664e4086087c1d5371bb8e8f4fc676e0d))
* **debugger:** timestamp the bridge log and name the connected device ([#401](https://github.com/marioparaschiv/unbound/issues/401)) ([61ba33f](https://github.com/marioparaschiv/unbound/commit/61ba33f333f939dac9e8c0f98c40d2b468a2c604))


### Bug Fixes

* **loader:** unblock the iOS smoke test's debugger and launch ([#395](https://github.com/marioparaschiv/unbound/issues/395)) ([cf10319](https://github.com/marioparaschiv/unbound/commit/cf10319266cbd0f770f70c954df84698fc829f2e))


### Code Refactoring

* remove unused code and needless exports ([#433](https://github.com/marioparaschiv/unbound/issues/433)) ([0d44d8c](https://github.com/marioparaschiv/unbound/commit/0d44d8cd896965f7da484f5e83c5f0b711677fdc))


### Build System

* **deps:** bump tsdown ([e5cbf89](https://github.com/marioparaschiv/unbound/commit/e5cbf8969f698875d454d12b5d0250764ae9154c))
* **deps:** merge the open Dependabot updates ([cab317a](https://github.com/marioparaschiv/unbound/commit/cab317a1c8e962de4a197f298c42296b6a2afb8d))
* **deps:** merge tsdown 0.23.2 and block scoping 8 ([463b6c4](https://github.com/marioparaschiv/unbound/commit/463b6c478ea512a73b685275d03582758f362a6c))


### Continuous Integration

* **loader:** reuse IPAs, typecheck PRs and fix the Forms fallback ([ffc6658](https://github.com/marioparaschiv/unbound/commit/ffc6658c13366c3abebff9b4ff1aac5bbeb672de))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.9.0

## [0.8.1](https://github.com/marioparaschiv/unbound/compare/debugger-v0.8.0...debugger-v0.8.1) (2026-10-25)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.8.1
