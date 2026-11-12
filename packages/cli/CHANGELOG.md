# Changelog

## [3.0.1](https://github.com/marioparaschiv/unbound/compare/cli-v3.0.0...cli-v3.0.1) (2026-11-12)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger bumped to 1.0.1
    * @unbound-app/debugger-protocol bumped to 2.0.1
  * devDependencies
    * @unbound-app/api bumped to 3.1.0
    * @unbound-app/contracts bumped to 2.1.0
    * @unbound-app/types bumped to 1.1.0
    * @unbound-app/utils bumped to 1.0.1
    * @unbound-app/web bumped to 2.1.0

## [3.0.0](https://github.com/marioparaschiv/unbound/compare/cli-v2.1.1...cli-v3.0.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* plugins.entities is plugins.addons, FontEntity is Font, NativePlugin* types and errors are NativeBridge* (NativePluginRuntimeBridge is LoaderNativeBridge), NATIVE_PLUGIN_* constants are NATIVE_BRIDGE_*, the manifest's minNativePluginApi is minNativeBridgeApi, and CORE_SETTINGS_STORE, SYNC_STORE and SettingsStores are CORE_BUCKET, SYNC_BUCKET and SettingsByBucket.
* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).

### Bug Fixes

* **cli:** fix four ubd bugs found during device proofs ([#1102](https://github.com/marioparaschiv/unbound/issues/1102)) ([51fb516](https://github.com/marioparaschiv/unbound/commit/51fb516a16b31f44d220e358a54d5248adddcc02))


### Code Refactoring

* finish the plugin shape and glossary renames ([#1099](https://github.com/marioparaschiv/unbound/issues/1099)) ([81ffa53](https://github.com/marioparaschiv/unbound/commit/81ffa5324f4b350cb34a9f34d84f25259f4e6d35))
* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))
* **plugins:** move platform files into ios/ and android/ ([#1103](https://github.com/marioparaschiv/unbound/issues/1103)) ([60977d9](https://github.com/marioparaschiv/unbound/commit/60977d9c30226a7784d2c81081745285d70814df))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger bumped to 1.0.0
    * @unbound-app/debugger-protocol bumped to 2.0.0
    * @unbound-app/rollup-plugin-hermes bumped to 3.0.0
  * devDependencies
    * @unbound-app/api bumped to 3.0.0
    * @unbound-app/contracts bumped to 2.0.0
    * @unbound-app/types bumped to 1.0.0
    * @unbound-app/utils bumped to 1.0.0
    * @unbound-app/web bumped to 2.0.0

## [2.1.1](https://github.com/marioparaschiv/unbound/compare/cli-v2.1.0...cli-v2.1.1) (2026-11-11)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger bumped to 0.10.5
    * @unbound-app/debugger-protocol bumped to 1.0.2
  * devDependencies
    * @unbound-app/api bumped to 2.2.0
    * @unbound-app/contracts bumped to 1.1.1
    * @unbound-app/types bumped to 0.15.0
    * @unbound-app/utils bumped to 0.10.4
    * @unbound-app/web bumped to 1.1.1

## [2.1.0](https://github.com/marioparaschiv/unbound/compare/cli-v2.0.0...cli-v2.1.0) (2026-11-11)


### Features

* **client:** draw settings-kit rows with Discord's built-ins ([#1084](https://github.com/marioparaschiv/unbound/issues/1084)) ([cb3b9e2](https://github.com/marioparaschiv/unbound/commit/cb3b9e285094a1f55d4eb75ed8e19826e61758fa))
* **devtools:** bundle ubd, add settings dialog, smooth scroll ([#1083](https://github.com/marioparaschiv/unbound/issues/1083)) ([82f9aaa](https://github.com/marioparaschiv/unbound/commit/82f9aaae9c7a2a9e8dae5f31806806f8ccb7bfe6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger bumped to 0.10.4
    * @unbound-app/debugger-protocol bumped to 1.0.1
  * devDependencies
    * @unbound-app/api bumped to 2.1.0
    * @unbound-app/contracts bumped to 1.1.0
    * @unbound-app/types bumped to 0.14.0
    * @unbound-app/utils bumped to 0.10.3
    * @unbound-app/web bumped to 1.1.0

## [2.0.0](https://github.com/marioparaschiv/unbound/compare/cli-v1.1.2...cli-v2.0.0) (2026-11-10)


### ⚠ BREAKING CHANGES

* **cli:** root commands such as `ubd eval`, `ubd push`, `ubd install` and `ubd login` now live under groups (`ubd debug eval`, `ubd device install`, `ubd auth login`); `i18n` flags became subcommands; MCP tools `install` and `device` became `device_install`, `device_reset`, `device_save`, `device_restore` and `device_snapshots`.

### Code Refactoring

* **cli:** group commands under debug, device, i18n and auth ([#1065](https://github.com/marioparaschiv/unbound/issues/1065)) ([122791d](https://github.com/marioparaschiv/unbound/commit/122791ddec70095a679380c5a48dfe6419dba939))


### Documentation

* rewrite the guides around up-front concepts ([#1064](https://github.com/marioparaschiv/unbound/issues/1064)) ([35a35a6](https://github.com/marioparaschiv/unbound/commit/35a35a6068221e40cb4ae4ea47263ce612ab8453))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger bumped to 0.10.3
    * @unbound-app/debugger-protocol bumped to 1.0.0
  * devDependencies
    * @unbound-app/api bumped to 2.0.0
    * @unbound-app/contracts bumped to 1.0.0
    * @unbound-app/web bumped to 1.0.0

## [1.1.2](https://github.com/marioparaschiv/unbound/compare/cli-v1.1.1...cli-v1.1.2) (2026-11-09)


### Bug Fixes

* **cli:** install without peer dependency warnings ([#1034](https://github.com/marioparaschiv/unbound/issues/1034)) ([d447bda](https://github.com/marioparaschiv/unbound/commit/d447bda702dee11a998ae2cabb070edbbe14a73e))

## [1.1.1](https://github.com/marioparaschiv/unbound/compare/cli-v1.1.0...cli-v1.1.1) (2026-11-09)


### Bug Fixes

* **ci:** finish npm publish, skip unnamed TestFlight releases ([#1026](https://github.com/marioparaschiv/unbound/issues/1026)) ([db758dc](https://github.com/marioparaschiv/unbound/commit/db758dcbbeb3429a1bf84484fe843d62e5956087))
* **cli:** bundle the private contracts package into the published build ([#1029](https://github.com/marioparaschiv/unbound/issues/1029)) ([0fe5b40](https://github.com/marioparaschiv/unbound/commit/0fe5b408e6ddfd1ebf2126b1c428bb51350c9cc9))
* **client:** run UI worklets on Reanimated 4's worklets runtime ([#1028](https://github.com/marioparaschiv/unbound/issues/1028)) ([269995c](https://github.com/marioparaschiv/unbound/commit/269995c755d6b186af09fa5807cecb29b9411a4b))
* **cli:** make the published CLI scaffold, build and bridge ([#1031](https://github.com/marioparaschiv/unbound/issues/1031)) ([312690e](https://github.com/marioparaschiv/unbound/commit/312690e035a0158fb45ee8914701832ffabc77fd))


### Performance Improvements

* **loader:** lazy settings cache, metro cache file, plugin bytecode installs ([#1032](https://github.com/marioparaschiv/unbound/issues/1032)) ([87179aa](https://github.com/marioparaschiv/unbound/commit/87179aad6016c4e019546bb9ae0ba9d19147f614))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger bumped to 0.10.2
    * @unbound-app/debugger-protocol bumped to 0.11.1
  * devDependencies
    * @unbound-app/api bumped to 1.1.1
    * @unbound-app/contracts bumped to 0.14.1
    * @unbound-app/types bumped to 0.13.1
    * @unbound-app/utils bumped to 0.10.2
    * @unbound-app/web bumped to 0.14.1

## [1.1.0](https://github.com/marioparaschiv/unbound/compare/cli-v1.0.0...cli-v1.1.0) (2026-11-09)


### Features

* **themes:** add Rosie themes, a theme maker and theme hot reload ([#985](https://github.com/marioparaschiv/unbound/issues/985)) ([0c926db](https://github.com/marioparaschiv/unbound/commit/0c926dbc03587960ac2d16f16cdd78fd07abfc5e))


### Bug Fixes

* **cli:** treat expired agent vphone claims as stale ([#982](https://github.com/marioparaschiv/unbound/issues/982)) ([e0ac74a](https://github.com/marioparaschiv/unbound/commit/e0ac74a0ec538e98cabc8d6de717bb93e7a30acc))


### Performance Improvements

* **ci:** cut pull request CI wall time ([#1021](https://github.com/marioparaschiv/unbound/issues/1021)) ([0e5e0a7](https://github.com/marioparaschiv/unbound/commit/0e5e0a7ec4f6c107e78f6afca3409eca3b953be0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/contracts bumped to 0.14.0
    * @unbound-app/debugger-protocol bumped to 0.11.0
  * devDependencies
    * @unbound-app/api bumped to 1.1.0
    * @unbound-app/types bumped to 0.13.0
    * @unbound-app/utils bumped to 0.10.1
    * @unbound-app/web bumped to 0.14.0

## [1.0.0](https://github.com/marioparaschiv/unbound/compare/cli-v0.12.0...cli-v1.0.0) (2026-11-05)


### ⚠ BREAKING CHANGES

* **rollup-plugin-hermes:** the plugin is ESM-only, `manifestUrl` is now `registryUrl`, and the manifest helpers moved from dist/manifest.js to the `./manifest` export.

### Features

* **cli:** add an on-device startup and memory bench ([#805](https://github.com/marioparaschiv/unbound/issues/805)) ([aa199ca](https://github.com/marioparaschiv/unbound/commit/aa199ca3d10f3b16cae47e6eab49008a60f1f43f))
* **cli:** add the unbound rollup preset for plugins ([#683](https://github.com/marioparaschiv/unbound/issues/683)) ([1b7b007](https://github.com/marioparaschiv/unbound/commit/1b7b0070ea2b8aac74349053d6bdaf0c506cb19f))
* **cli:** add ubd profile for Hermes' sampling profiler ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **client:** add addon, updates, sync and builtins namespaces ([#727](https://github.com/marioparaschiv/unbound/issues/727)) ([edbbc37](https://github.com/marioparaschiv/unbound/commit/edbbc3791ab8e2681c44b49297b892d936d776a4))
* **client:** evaluate plugins with a per-plugin Addon scope ([#721](https://github.com/marioparaschiv/unbound/issues/721)) ([a58fe1c](https://github.com/marioparaschiv/unbound/commit/a58fe1ce39a303ef5edec93e21175914c1a738c2))
* **client:** expose plugin start durations ([b7e7a9a](https://github.com/marioparaschiv/unbound/commit/b7e7a9aea635e6b420fea7e709a425e1973d6ae0))
* **client:** rebuild Plugins and Design settings on Discord primitives ([#964](https://github.com/marioparaschiv/unbound/issues/964)) ([cd4349f](https://github.com/marioparaschiv/unbound/commit/cd4349fdd5b74ede4f267d7716ad16380c51fc9c))
* **client:** splice hook changes in place during hot refresh ([#890](https://github.com/marioparaschiv/unbound/issues/890)) ([ab1355c](https://github.com/marioparaschiv/unbound/commit/ab1355c493239e287dcd9c2f6a6895aeae7fb39d))
* **cli:** generate platforms and Capabilities in ubd build ([#729](https://github.com/marioparaschiv/unbound/issues/729)) ([7deb4b2](https://github.com/marioparaschiv/unbound/commit/7deb4b23cb810fa7643557613ed4d763aded3b5f))
* **cli:** keep line info in plugin bytecode ([a187d1f](https://github.com/marioparaschiv/unbound/commit/a187d1f7bdd42cb4fb2fcdffed9885030b6cee2b))
* **cli:** measure ADDON.md media in ubd build ([#704](https://github.com/marioparaschiv/unbound/issues/704)) ([efe25d9](https://github.com/marioparaschiv/unbound/commit/efe25d92051183c8d39f4847ac71264e3702961e))
* **cli:** overhaul the plugin developer experience ([#907](https://github.com/marioparaschiv/unbound/issues/907)) ([64e34e7](https://github.com/marioparaschiv/unbound/commit/64e34e7729ed1edf3677acdabbd32900a0945c9a))
* **cli:** run post-build checks in ubd build ([#685](https://github.com/marioparaschiv/unbound/issues/685)) ([88e2f4e](https://github.com/marioparaschiv/unbound/commit/88e2f4e8080a92d0bebdc39f4864d9d3885f7ca6))
* **cli:** scaffold the standard plugin tree with ubd create ([#733](https://github.com/marioparaschiv/unbound/issues/733)) ([63d3fc8](https://github.com/marioparaschiv/unbound/commit/63d3fc8b66b8f0a75359ac172a9b1e993b6ba6ef))
* **cli:** show plugin start times in ubd status ([b7e7a9a](https://github.com/marioparaschiv/unbound/commit/b7e7a9aea635e6b420fea7e709a425e1973d6ae0))
* **cli:** validate addon naming, Capabilities and layout ([#699](https://github.com/marioparaschiv/unbound/issues/699)) ([a8f2704](https://github.com/marioparaschiv/unbound/commit/a8f2704b743e08a306607bd18d5717756edf09b4))
* **native:** run plugin hooks on the UI thread ([4dde7a6](https://github.com/marioparaschiv/unbound/commit/4dde7a66bc26463ebc0e043c6c630727f3dba730))
* **rollup-plugin-hermes:** move hermes tooling into the repo ([#957](https://github.com/marioparaschiv/unbound/issues/957)) ([b91ec1e](https://github.com/marioparaschiv/unbound/commit/b91ec1e283e51ddf94a5296872181856e68655b8))
* **web,cli:** read the built manifest for publish and ubd dev ([#696](https://github.com/marioparaschiv/unbound/issues/696)) ([f417abc](https://github.com/marioparaschiv/unbound/commit/f417abc0d88f19f2144dc9a2dc5b7f8dde9b7cdd))
* **web:** read the measured ADDON.md page on submission ([#706](https://github.com/marioparaschiv/unbound/issues/706)) ([29627b6](https://github.com/marioparaschiv/unbound/commit/29627b6b13831e2ab949a4cfa6216f51b20ff096))


### Bug Fixes

* clear the lint, type and test failures on main ([#932](https://github.com/marioparaschiv/unbound/issues/932)) ([594831f](https://github.com/marioparaschiv/unbound/commit/594831f1839c6bc0278cc552d52aa368b3c5c841))
* **cli:** compile worklets before swc ([b7a63da](https://github.com/marioparaschiv/unbound/commit/b7a63dacfad77df7e1b535153c13b8637e688096))
* **cli:** resolve symlinked paths in the capabilities check ([dd36438](https://github.com/marioparaschiv/unbound/commit/dd36438aa275b380bcc7a4baf0207ae72b1a0868))


### Performance Improvements

* **client:** cut the bundle by 28% and move off zod ([#868](https://github.com/marioparaschiv/unbound/issues/868)) ([e662499](https://github.com/marioparaschiv/unbound/commit/e662499d9553f8025a0f72ab03710273ba0507da))
* **client:** load modules on demand, import Discord's libraries ([#789](https://github.com/marioparaschiv/unbound/issues/789)) ([d732248](https://github.com/marioparaschiv/unbound/commit/d7322488f7019307615246b4fc29d60fa5d85330))
* **loader:** harden the native runtime and add cheaper native paths ([#879](https://github.com/marioparaschiv/unbound/issues/879)) ([3686732](https://github.com/marioparaschiv/unbound/commit/36867326491240cc5ab27082a795537df282de27))
* **loader:** keep compiled plugin sources off the JS heap ([0c2c07e](https://github.com/marioparaschiv/unbound/commit/0c2c07eec18cd1955cf023162795c6adc2e35a82))
* **loader:** third native round, legacy removal, three Vencord ports ([#885](https://github.com/marioparaschiv/unbound/issues/885)) ([7311206](https://github.com/marioparaschiv/unbound/commit/7311206e0f0fad007bfc086fadd1c17181679fae))


### Code Refactoring

* **client:** remove deprecated APIs and document the SDK ([#795](https://github.com/marioparaschiv/unbound/issues/795)) ([ae90809](https://github.com/marioparaschiv/unbound/commit/ae90809cad35698c8df7e954ff283a526500fb13))
* **plugins:** migrate every plugin to the new plugin setup ([#910](https://github.com/marioparaschiv/unbound/issues/910)) ([bea93f7](https://github.com/marioparaschiv/unbound/commit/bea93f7d146092cb72ed7892c3c97174ba7af6ae))
* rename astral back to unbound ([#751](https://github.com/marioparaschiv/unbound/issues/751)) ([05faca1](https://github.com/marioparaschiv/unbound/commit/05faca1a9fef48992fd80f981f009d02da943b40))


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
    * @unbound-app/contracts bumped to 0.13.0
    * @unbound-app/debugger-protocol bumped to 0.10.0
    * @unbound-app/rollup-plugin-hermes bumped to 2.0.0
  * devDependencies
    * @unbound-app/api bumped to 1.0.0
    * @unbound-app/types bumped to 0.12.0
    * @unbound-app/utils bumped to 0.10.0
    * @unbound-app/web bumped to 0.13.0

## [0.12.0](https://github.com/marioparaschiv/unbound/compare/cli-v0.11.0...cli-v0.12.0) (2026-10-31)


### Features

* **cli:** follow the iOS log file with ranged file_read calls ([#517](https://github.com/marioparaschiv/unbound/issues/517)) ([c71661d](https://github.com/marioparaschiv/unbound/commit/c71661da3c87d6790433e61b0d84e2e6a766035c))
* **cli:** read iOS log history from the loader's log files ([#513](https://github.com/marioparaschiv/unbound/issues/513)) ([3ad9e2d](https://github.com/marioparaschiv/unbound/commit/3ad9e2d02ca064e4e930c8acfec82a043d42ac8e))


### Bug Fixes

* **client:** read core settings from the loader's store ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **cli:** follow the loader log file when the iPhone's log is silent ([#504](https://github.com/marioparaschiv/unbound/issues/504)) ([251a24a](https://github.com/marioparaschiv/unbound/commit/251a24a225dbca4740d1827a538ad416afd74a9f))
* **cli:** lower block scoping in code evaluated on the device ([#520](https://github.com/marioparaschiv/unbound/issues/520)) ([d37a94e](https://github.com/marioparaschiv/unbound/commit/d37a94e492b258ac3c1ed986347222f506709050))
* **cli:** refuse pushes older than shared workspace code ([#531](https://github.com/marioparaschiv/unbound/issues/531)) ([3a23cdf](https://github.com/marioparaschiv/unbound/commit/3a23cdf45f51a1925b28a4abacdee1216a4ddfd1))
* **cli:** refuse to push a stale build, and honour --no-&lt;flag&gt; ([#522](https://github.com/marioparaschiv/unbound/issues/522)) ([6deb87a](https://github.com/marioparaschiv/unbound/commit/6deb87a726b6c1a930e0a8bb8220d07ce913316f))
* **plugins:** reach the Android module's current class names ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Code Refactoring

* fix architecture smells and enforce them with oxlint rules ([#574](https://github.com/marioparaschiv/unbound/issues/574)) ([577a2af](https://github.com/marioparaschiv/unbound/commit/577a2af9ca4f479a805765481927b1ff9302c1ec))
* **loader:** choose the Android build in a tested command ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **plugins:** move first-party plugin ids to the new namespace ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Build System

* **deps:** bump @babel/plugin-transform-block-scoping ([#609](https://github.com/marioparaschiv/unbound/issues/609)) ([19d49f9](https://github.com/marioparaschiv/unbound/commit/19d49f9f3a94f0dafe15f9ca41bb9d5a81c213e5))
* treat Bun's empty test runs as passing in the pre-push hook ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Tests

* **cli:** check the eval lowering without node:vm ([#523](https://github.com/marioparaschiv/unbound/issues/523)) ([1b941de](https://github.com/marioparaschiv/unbound/commit/1b941dee9f7082faaccd507566b795f9958eba0f))
* **cli:** skip the Postgres suites when no database is configured ([#542](https://github.com/marioparaschiv/unbound/issues/542)) ([b36ebd2](https://github.com/marioparaschiv/unbound/commit/b36ebd252daf649c4d717f4f16ea5ae412e89850))
* **cli:** type the inspect request helper ([#532](https://github.com/marioparaschiv/unbound/issues/532)) ([0bd931e](https://github.com/marioparaschiv/unbound/commit/0bd931e6ad707344d21ae98c136910093f44fd2a))
* **core:** keep sanitizer reports out of the crash attribution children ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* remove tautological tests and stop pinning brittle details ([#437](https://github.com/marioparaschiv/unbound/issues/437)) ([b69ca6c](https://github.com/marioparaschiv/unbound/commit/b69ca6c97c6470ac6cb1b0fa515c6e2f79639ba7))


### Continuous Integration

* **deps:** fit Dependabot titles to the commit header limit ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** build PRs against the current App Store Discord ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** let main builds finish instead of cancelling each other ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** show smoke failures and the first crash in the PR comment ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))
* **loader:** skip the Android smoke test for unattested builds ([e655fc4](https://github.com/marioparaschiv/unbound/commit/e655fc49a4f8e46797a51d6add44a439f3271414))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.9.1
  * devDependencies
    * @unbound-app/api bumped to 0.12.0
    * @unbound-app/contracts bumped to 0.12.0
    * @unbound-app/types bumped to 0.11.0
    * @unbound-app/utils bumped to 0.9.2
    * @unbound-app/web bumped to 0.12.0

## [0.11.0](https://github.com/marioparaschiv/unbound/compare/cli-v0.10.0...cli-v0.11.0) (2026-10-29)


### Features

* **cli:** add ubd logs and ubd inspect, kill timed-out step trees ([b2c6307](https://github.com/marioparaschiv/unbound/commit/b2c630739d7b8fb5b68d8fc0f53d18dd54c63880))
* **cli:** add ubd status and ubd bridge restart ([#413](https://github.com/marioparaschiv/unbound/issues/413)) ([ca2a235](https://github.com/marioparaschiv/unbound/commit/ca2a235a73f37f6425fc91dfb6a2dd9dc953805d))
* **cli:** device tooling for install, eval and discord-apk ([b394139](https://github.com/marioparaschiv/unbound/commit/b3941395ea031958504e3530bd0747465a6c1a1f))
* **client:** tag dev copies and reinstall them from the store ([#412](https://github.com/marioparaschiv/unbound/issues/412)) ([b0ad554](https://github.com/marioparaschiv/unbound/commit/b0ad5543c78c544cba641e9186a94fffaaf0e2e8))
* **cli:** inspect native classes and views with ubd inspect ([fa3ed0b](https://github.com/marioparaschiv/unbound/commit/fa3ed0b9b5896b84434b52929528025e4c4419ac))
* **cli:** install plugins on jailbroken iPhones ([a5a5f62](https://github.com/marioparaschiv/unbound/commit/a5a5f6233e29927304ca32d058a98e5e31d4d852))
* **cli:** push compiled bytecode with a plugin ([#425](https://github.com/marioparaschiv/unbound/issues/425)) ([87624bb](https://github.com/marioparaschiv/unbound/commit/87624bb81463b9eb529c82cca3dda1fef8b9b581))
* **cli:** reset, snapshot and restore Unbound state on a device ([42494b0](https://github.com/marioparaschiv/unbound/commit/42494b0bddda63788a8fa4bc2cfbc3b05930fc84))
* **cli:** reset, snapshot and restore Unbound state on a device ([31dc9f4](https://github.com/marioparaschiv/unbound/commit/31dc9f4e52c0168bfa6852d2776235e8ed7000b7))
* **cli:** symbolicate pulled log files with --symbolicate ([29b0c72](https://github.com/marioparaschiv/unbound/commit/29b0c723e323708258e455ab997e113b12b97ddb))
* **cli:** symbolicate pulled log files with --symbolicate ([57ee338](https://github.com/marioparaschiv/unbound/commit/57ee3388e132cf345325139dd11d2f3d01f5aa3b))
* **cli:** tail Discord's filtered log with ubd logs ([3a0693a](https://github.com/marioparaschiv/unbound/commit/3a0693acb7848effbc35ea8ffcce215f59f51340))
* **cli:** watch native resources with ubd status --watch ([#418](https://github.com/marioparaschiv/unbound/issues/418)) ([ffd5e3c](https://github.com/marioparaschiv/unbound/commit/ffd5e3ca32d17e34a70644710c8d126ff80aaabb))
* **debugger:** let eval callers choose the timeout ([0ce5a66](https://github.com/marioparaschiv/unbound/commit/0ce5a66664e4086087c1d5371bb8e8f4fc676e0d))
* **loader:** keep rotating log files on device, pull with ubd logs ([e1aa570](https://github.com/marioparaschiv/unbound/commit/e1aa5707f86d2f4200ebf15e6791ee549879b08d))
* **loader:** keep rotating log files on device, pull with ubd logs ([0206e8e](https://github.com/marioparaschiv/unbound/commit/0206e8eb09d18681263d3709d84ba7009a95b7ac))
* **web:** run apps/web on Postgres ([eeeb00f](https://github.com/marioparaschiv/unbound/commit/eeeb00f5038de965622e24a19e9b9cea74cab1b3))


### Bug Fixes

* **cli:** kill a timed-out step's whole process group ([2761cca](https://github.com/marioparaschiv/unbound/commit/2761ccaa7b008b892d0f96c76b681c0757c81390))
* **cli:** show each command's summary in ubd help ([d722935](https://github.com/marioparaschiv/unbound/commit/d7229355a31620fd30fb6a6ee8c5af65080c9302))
* **cli:** unlock the iPhone before relaunching Discord ([5232ba0](https://github.com/marioparaschiv/unbound/commit/5232ba01d6f302eeef37b52ce134b89403d27892))
* **cli:** wake the iPhone without lifting its blackout ([e9e1c64](https://github.com/marioparaschiv/unbound/commit/e9e1c642f565a72a6c83d3c53adc3f2fa74028c3))
* **cli:** wake the iPhone without lifting its blackout ([98092b3](https://github.com/marioparaschiv/unbound/commit/98092b3ec53102da269a799c44c1ed9e80a40c02))


### Performance Improvements

* **cli:** find addons without walking node_modules ([695ddc4](https://github.com/marioparaschiv/unbound/commit/695ddc4c045be8b898400db430a205b7a09ea1ec))
* **shiki-codeblocks:** load grammars from files on first use ([#426](https://github.com/marioparaschiv/unbound/issues/426)) ([195f8a7](https://github.com/marioparaschiv/unbound/commit/195f8a792064d38645f4a5dd03e9d6c9339d5095))


### Code Refactoring

* remove unused code and needless exports ([#433](https://github.com/marioparaschiv/unbound/issues/433)) ([0d44d8c](https://github.com/marioparaschiv/unbound/commit/0d44d8cd896965f7da484f5e83c5f0b711677fdc))


### Build System

* **deps:** bump cleye from 1.3.4 to 2.7.0 ([c963901](https://github.com/marioparaschiv/unbound/commit/c9639019e64cf4607bff0bc3ea048d70491d884c))
* **deps:** bump tsdown ([e5cbf89](https://github.com/marioparaschiv/unbound/commit/e5cbf8969f698875d454d12b5d0250764ae9154c))
* **deps:** merge the open Dependabot updates ([cab317a](https://github.com/marioparaschiv/unbound/commit/cab317a1c8e962de4a197f298c42296b6a2afb8d))
* **deps:** merge the safe Dependabot updates ([f987306](https://github.com/marioparaschiv/unbound/commit/f98730620b99a31a40eab071db547477c1dbbd0b))
* **deps:** merge tsdown 0.23.2 and block scoping 8 ([463b6c4](https://github.com/marioparaschiv/unbound/commit/463b6c478ea512a73b685275d03582758f362a6c))


### Continuous Integration

* **loader:** reuse IPAs, typecheck PRs and fix the Forms fallback ([ffc6658](https://github.com/marioparaschiv/unbound/commit/ffc6658c13366c3abebff9b4ff1aac5bbeb672de))
* **loader:** run Kotlin tests; check the AVD dev setup ([2e318a9](https://github.com/marioparaschiv/unbound/commit/2e318a98d8df9b8a5192ae1523ec508cfd7a7c0a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.9.0
  * devDependencies
    * @unbound-app/api bumped to 0.11.0
    * @unbound-app/contracts bumped to 0.11.0
    * @unbound-app/types bumped to 0.10.0
    * @unbound-app/utils bumped to 0.9.1
    * @unbound-app/web bumped to 0.11.0

## [0.10.0](https://github.com/marioparaschiv/unbound/compare/cli-v0.9.0...cli-v0.10.0) (2026-10-25)


### Features

* **cli:** add plugin analysis commands ([50745ea](https://github.com/marioparaschiv/unbound/commit/50745eacb196a66ab7780beba0fa0f4e8e6a1dac))
* **client:** consolidate plugin and native platform parity ([#204](https://github.com/marioparaschiv/unbound/issues/204)) ([045fcc0](https://github.com/marioparaschiv/unbound/commit/045fcc0e6ecfd64403c1a9ca463f629764358f12))
* **cli:** publish the pushed commit instead of uploading a build ([dcc3341](https://github.com/marioparaschiv/unbound/commit/dcc3341a1dd1399bde41ddeac4391b2a7c4426be))
* **contracts:** add shared workspace discovery rules ([33531c2](https://github.com/marioparaschiv/unbound/commit/33531c2634092e1cf3dc3a48badce1ce4fc27301))
* move the native loaders into the monorepo and reach Android plugin parity ([98347e6](https://github.com/marioparaschiv/unbound/commit/98347e6c109a74ace67bb9b951ac32c2a7a7650f))
* **native:** compose the fabric bridge on Android ([d09c309](https://github.com/marioparaschiv/unbound/commit/d09c309a6d4e4032df936656772add5fc81a2422))
* **web:** GitHub publishing groundwork: shared discovery, GitHub reader, version sources ([a1b856c](https://github.com/marioparaschiv/unbound/commit/a1b856c9c2b2edf2bb5038e4bdb5456eea6f595b))
* **web:** publish addons from a pinned GitHub commit, with ADDON.md and typed changelogs ([1648e22](https://github.com/marioparaschiv/unbound/commit/1648e2276491f153e8ede2334430a780b3da4365))


### Bug Fixes

* **cli:** borrow a bridge that holds every capability a probe uses ([ff266ae](https://github.com/marioparaschiv/unbound/commit/ff266ae7681d349bd365f0e2cebc65b6f4c43d4c))


### Code Refactoring

* **cli:** discover addons through the contracts workspace rules ([a861045](https://github.com/marioparaschiv/unbound/commit/a86104585b9f3863aea6bef583336c4a85bc329b))
* **plugins:** rewrite sample plugins into a shared layout ([#206](https://github.com/marioparaschiv/unbound/issues/206)) ([a50a473](https://github.com/marioparaschiv/unbound/commit/a50a473a2eff3ab812d8bfd7c249b27b8298c405))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @unbound-app/debugger-protocol bumped to 0.8.1
  * devDependencies
    * @unbound-app/api bumped to 0.10.0
    * @unbound-app/contracts bumped to 0.10.0
    * @unbound-app/types bumped to 0.9.0
    * @unbound-app/utils bumped to 0.9.0
    * @unbound-app/web bumped to 0.10.0
