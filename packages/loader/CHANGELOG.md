# Changelog

## [1.3.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.2.0...loader-v1.3.0) (2026-11-12)


### Features

* **client:** add support, issues and context to /debug ([#1147](https://github.com/marioparaschiv/unbound/issues/1147)) ([05b2839](https://github.com/marioparaschiv/unbound/commit/05b2839cb43f575aaad7bd2b96cbe9580c374815))
* **loader:** add WOFF2 and variable fonts, centre tall fonts ([#1142](https://github.com/marioparaschiv/unbound/issues/1142)) ([ccf0462](https://github.com/marioparaschiv/unbound/commit/ccf04625b5eb6baf4c6560f0513de63f701f2587))
* **loader:** let UI scopes implement Java interfaces ([f8ca349](https://github.com/marioparaschiv/unbound/commit/f8ca3499ea8627dfc5f57560928676278b65dea9))


### Bug Fixes

* **loader:** return from off-main Android hook dispatch ([#1139](https://github.com/marioparaschiv/unbound/issues/1139)) ([050f74f](https://github.com/marioparaschiv/unbound/commit/050f74f10ac66a468e1657226bd592d8f3f7b3ab))
* tidy the install and state debug lines ([#1143](https://github.com/marioparaschiv/unbound/issues/1143)) ([f1a2a2f](https://github.com/marioparaschiv/unbound/commit/f1a2a2f3999db8da506373b0248eef644b11bcef))

## [1.2.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.1.1...loader-v1.2.0) (2026-11-12)


### ⚠ BREAKING CHANGES

* plugins.entities is plugins.addons, FontEntity is Font, NativePlugin* types and errors are NativeBridge* (NativePluginRuntimeBridge is LoaderNativeBridge), NATIVE_PLUGIN_* constants are NATIVE_BRIDGE_*, the manifest's minNativePluginApi is minNativeBridgeApi, and CORE_SETTINGS_STORE, SYNC_STORE and SettingsStores are CORE_BUCKET, SYNC_BUCKET and SettingsByBucket.
* @unbound-app/api/testing exports only the plugin test kit (startPlugin, stopPlugin, render, recorders, fakeAssetId, StoreSeeds, PluginTypes). The building blocks moved to @unbound-app/api/testing/fakes; act, createTestRenderer and TestRenderer are removed (use render); the @unbound-app/api/testing/icu-parse subpath is removed (the parser lives in @unbound-app/contracts).
* **cli:** root commands such as `ubd eval`, `ubd push`, `ubd install` and `ubd login` now live under groups (`ubd debug eval`, `ubd device install`, `ubd auth login`); `i18n` flags became subcommands; MCP tools `install` and `device` became `device_install`, `device_reset`, `device_save`, `device_restore` and `device_snapshots`.

### Features

* **icon-packs:** publish first-party icon packs ([#1077](https://github.com/marioparaschiv/unbound/issues/1077)) ([16593ff](https://github.com/marioparaschiv/unbound/commit/16593ff7c42a7f76c47647b10c0df6e4e953a670))
* **loader:** catch frozen starts and show how installs were signed ([#1113](https://github.com/marioparaschiv/unbound/issues/1113)) ([562aa90](https://github.com/marioparaschiv/unbound/commit/562aa9051c36e82d4e3577697d73a64e3397d4db))
* **loader:** health-gated updates and crash recovery ([#1063](https://github.com/marioparaschiv/unbound/issues/1063)) ([0cd3772](https://github.com/marioparaschiv/unbound/commit/0cd37726daa68a2a8c4a2cae49c01e881649ce2e))
* **loader:** judge launches by render and exit, retry updates ([#1086](https://github.com/marioparaschiv/unbound/issues/1086)) ([cd39991](https://github.com/marioparaschiv/unbound/commit/cd399911d22a11fe8fbf4db09d6ad3184302eb3b))
* **loader:** let UI-scope Java hooks rewrite their arguments ([#1130](https://github.com/marioparaschiv/unbound/issues/1130)) ([20893e2](https://github.com/marioparaschiv/unbound/commit/20893e2e907eec6a81f2279ac714eb01aab100e9))
* **loader:** show the iOS toolbox as a sheet with a microbold wrench ([#1131](https://github.com/marioparaschiv/unbound/issues/1131)) ([8aa3174](https://github.com/marioparaschiv/unbound/commit/8aa3174e233d3008f26065bd18fbce4c854d7514))


### Bug Fixes

* **client:** download the IPA for sideloaded loader updates ([#1048](https://github.com/marioparaschiv/unbound/issues/1048)) ([880fa81](https://github.com/marioparaschiv/unbound/commit/880fa812b96d85b4ec6f1f436b6d47e0ccb5f552))
* **loader:** keep addon start markers across iOS static init ([#1110](https://github.com/marioparaschiv/unbound/issues/1110)) ([a238e8a](https://github.com/marioparaschiv/unbound/commit/a238e8aa6eef4e026efabc019cf47f9f78a7cbc8))
* **loader:** keep bootstrap scripts across iOS static init ([#1107](https://github.com/marioparaschiv/unbound/issues/1107)) ([c23d042](https://github.com/marioparaschiv/unbound/commit/c23d0424ec9e0bdf3be909c90c5579cdb0502541))
* **loader:** keep the release changelog under the API limit ([#1115](https://github.com/marioparaschiv/unbound/issues/1115)) ([638b698](https://github.com/marioparaschiv/unbound/commit/638b698a71d864b252b37b36f78bf8c4f2e8e0d1))
* **loader:** let the compat gate pass LiveContainer LCAppInfo ([#1129](https://github.com/marioparaschiv/unbound/issues/1129)) ([46e85a0](https://github.com/marioparaschiv/unbound/commit/46e85a061ce4ef2785531b956bd39c3ffadd3122))
* **loader:** read entitlements from the kernel inside LiveContainer ([#1112](https://github.com/marioparaschiv/unbound/issues/1112)) ([50d53d0](https://github.com/marioparaschiv/unbound/commit/50d53d0ee823876b9faea50ca28e34fe347d1dbf))
* **loader:** republish the sideloaded IPA on loader updates ([#1050](https://github.com/marioparaschiv/unbound/issues/1050)) ([5664844](https://github.com/marioparaschiv/unbound/commit/5664844740e43449ce55dc1caa4dc05e2bec9d2f))
* **loader:** warn when the loader lacks native bridge API 1.3.0 ([#1136](https://github.com/marioparaschiv/unbound/issues/1136)) ([7e15ee3](https://github.com/marioparaschiv/unbound/commit/7e15ee37dcb9c48e7d07d765e11d63c60bccd855))


### Code Refactoring

* **cli:** group commands under debug, device, i18n and auth ([#1065](https://github.com/marioparaschiv/unbound/issues/1065)) ([122791d](https://github.com/marioparaschiv/unbound/commit/122791ddec70095a679380c5a48dfe6419dba939))
* finish the plugin shape and glossary renames ([#1099](https://github.com/marioparaschiv/unbound/issues/1099)) ([81ffa53](https://github.com/marioparaschiv/unbound/commit/81ffa5324f4b350cb34a9f34d84f25259f4e6d35))
* mirror tests in tests/ and untangle shared modules ([#1072](https://github.com/marioparaschiv/unbound/issues/1072)) ([cb7f397](https://github.com/marioparaschiv/unbound/commit/cb7f397e2570a83e25da79f609b73bcc60dd685d))

## [1.1.1](https://github.com/marioparaschiv/unbound/compare/loader-v1.1.0...loader-v1.1.1) (2026-11-10)


### Bug Fixes

* **loader:** cross-check iTunes with dkrypt in the stable poll ([#1045](https://github.com/marioparaschiv/unbound/issues/1045)) ([dc77dc9](https://github.com/marioparaschiv/unbound/commit/dc77dc9ecb9f5fcd09cd4316b4dfcb98e65f73ea))
* **loader:** let the compat gate pass the private UIPlaceholderColor ([#1043](https://github.com/marioparaschiv/unbound/issues/1043)) ([7663da1](https://github.com/marioparaschiv/unbound/commit/7663da12f80f842517f4df8eba5df2b028fbc0cf))
* **loader:** point release-please at the loader's version.json ([#1039](https://github.com/marioparaschiv/unbound/issues/1039)) ([e401981](https://github.com/marioparaschiv/unbound/commit/e401981b28802d446f1d43a8525e2cb7e557b1a1))
* **loader:** stop patching the App Store Discord bundle on jailbreak ([#1047](https://github.com/marioparaschiv/unbound/issues/1047)) ([f24c091](https://github.com/marioparaschiv/unbound/commit/f24c0919c5f8950eada54df6d2814a7ddf385c09))

## [1.1.0](https://github.com/marioparaschiv/unbound/compare/loader-v1.0.971...loader-v1.1.0) (2026-11-10)


### Features

* **app-icons:** custom app icons on every platform ([#987](https://github.com/marioparaschiv/unbound/issues/987)) ([9dbbcf8](https://github.com/marioparaschiv/unbound/commit/9dbbcf8bba4b7abcef6a27d99bb004d3c2a837ef))
* **client:** redesign the updater screen ([#1022](https://github.com/marioparaschiv/unbound/issues/1022)) ([f0677df](https://github.com/marioparaschiv/unbound/commit/f0677df1860f88f609d6beca7016cd9db0ae9b36))
* **loader:** draw the new Unbound icon in the Dynamic Island and notch ([#978](https://github.com/marioparaschiv/unbound/issues/978)) ([e23123d](https://github.com/marioparaschiv/unbound/commit/e23123d064070aada10aa20516127db23f140050))
* **themes:** add Rosie themes, a theme maker and theme hot reload ([#985](https://github.com/marioparaschiv/unbound/issues/985)) ([0c926db](https://github.com/marioparaschiv/unbound/commit/0c926dbc03587960ac2d16f16cdd78fd07abfc5e))


### Bug Fixes

* **ci:** finish npm publish, skip unnamed TestFlight releases ([#1026](https://github.com/marioparaschiv/unbound/issues/1026)) ([db758dc](https://github.com/marioparaschiv/unbound/commit/db758dcbbeb3429a1bf84484fe843d62e5956087))
* **ci:** unblock loader publishes after the billing pause ([#1018](https://github.com/marioparaschiv/unbound/issues/1018)) ([a8b0ad4](https://github.com/marioparaschiv/unbound/commit/a8b0ad4970bec504eb9ee63d5e2b6b975dd37762))
* **client:** run UI worklets on Reanimated 4's worklets runtime ([#1028](https://github.com/marioparaschiv/unbound/issues/1028)) ([269995c](https://github.com/marioparaschiv/unbound/commit/269995c755d6b186af09fa5807cecb29b9411a4b))
* **loader:** use semantic release versions ([#990](https://github.com/marioparaschiv/unbound/issues/990)) ([f4b0acd](https://github.com/marioparaschiv/unbound/commit/f4b0acd6cf9c577e767fc10a6561cf2b67f10a72))


### Performance Improvements

* **ci:** cut pull request CI wall time ([#1021](https://github.com/marioparaschiv/unbound/issues/1021)) ([0e5e0a7](https://github.com/marioparaschiv/unbound/commit/0e5e0a7ec4f6c107e78f6afca3409eca3b953be0))
* **loader:** lazy settings cache, metro cache file, plugin bytecode installs ([#1032](https://github.com/marioparaschiv/unbound/issues/1032)) ([87179aa](https://github.com/marioparaschiv/unbound/commit/87179aad6016c4e019546bb9ae0ba9d19147f614))
